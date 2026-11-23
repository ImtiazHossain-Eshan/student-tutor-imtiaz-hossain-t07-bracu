"""Build the retrieval index.

    tutor-ingest                 # data/course/{java,python}/{theory,lab} + ST data
    tutor-ingest --sample        # the small bundled sample set (for a demo without course files)
    tutor-ingest --no-vectors    # BM25 only, even if GOOGLE_API_KEY is set

Writes index/chunks.jsonl, index/manifest.json and, with a key, index/qdrant/.
"""
from __future__ import annotations

import argparse
import json
import logging
import shutil
from collections import Counter
from datetime import datetime, timezone

from tutor_agent.config import get_settings
from tutor_agent.ingest.chunker import chunk_sections
from tutor_agent.ingest.loaders import load_folder
from tutor_agent.st_data import st_sections


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sample", action="store_true", help="index data/sample instead of data/course")
    ap.add_argument("--no-vectors", action="store_true", help="skip embeddings (BM25 only)")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    s = get_settings()
    root = s.sample_dir if args.sample else s.course_dir
    if args.sample:  # the bundled sample notes are Java
        sections = load_folder(root / "theory", "theory", "java") + load_folder(root / "lab", "lab", "java")
    else:
        sections = [
            sec for lang in ("java", "python") for kind in ("theory", "lab")
            for sec in load_folder(root / lang / kind, kind, lang)
        ]
    sections += st_sections()
    chunks = chunk_sections(sections, s.chunk_chars, s.chunk_overlap)
    if not chunks:
        raise SystemExit(f"Nothing to index under {root}. Put files in {root}/<java|python>/<theory|lab>/.")

    if s.index_dir.exists():
        shutil.rmtree(s.index_dir)
    s.index_dir.mkdir(parents=True)
    with open(s.index_dir / "chunks.jsonl", "w", encoding="utf-8") as fh:
        for c in chunks:
            fh.write(json.dumps(c.to_dict(), ensure_ascii=False) + "\n")

    has_vectors, missing = False, 0
    if s.has_embeddings and not args.no_vectors:
        from tutor_agent.retrieval.vector import EmbeddingCache, QuotaExhausted, VectorIndex, make_embedder

        cache = EmbeddingCache(s.cache_dir / f"embeddings-{s.embedding_model}-{s.embedding_dim}.jsonl")
        embedder = make_embedder(s.google_api_key, s.embedding_model)
        try:
            idx, missing = VectorIndex.build(s.index_dir / "qdrant", chunks, embedder, s.embedding_dim, cache)
            idx.close()
            has_vectors = True
        except QuotaExhausted as exc:
            logging.warning("%s and nothing is cached: building BM25 only", exc)

    by_kind = Counter(c.kind for c in chunks)
    manifest = {
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "corpus": "sample" if args.sample else "course",
        "chunks": len(chunks),
        "by_kind": dict(by_kind),
        "by_language": dict(Counter(c.language for c in chunks)),
        "sources": sorted({f"{c.language}/{c.kind}/{c.source}" for c in chunks}),
        "has_vectors": has_vectors,
        "vectors_missing": missing,
        "embedding_model": s.embedding_model if has_vectors else None,
        "embedding_dim": s.embedding_dim if has_vectors else None,
        "chunk_chars": s.chunk_chars,
        "chunk_overlap": s.chunk_overlap,
    }
    (s.index_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    mode = "hybrid (BM25 + vectors)" if has_vectors else "BM25 only (no GOOGLE_API_KEY or --no-vectors)"
    print(f"Indexed {len(chunks)} chunks from {len(manifest['sources'])} sources {dict(by_kind)}: {mode}")
    if missing:
        print(f"{missing} chunks have no vector yet (embedding quota); they are still found by BM25. "
              "Run tutor-ingest again after the quota resets to complete the index.")


if __name__ == "__main__":
    main()
