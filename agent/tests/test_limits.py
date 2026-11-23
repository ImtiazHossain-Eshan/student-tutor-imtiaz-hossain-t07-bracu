from tutor_agent.web.limits import Limits, client_ip


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def test_per_minute_per_day_and_global_limits():
    c = Clock()
    lim = Limits(per_minute=2, per_day=3, global_per_day=4, clock=c)
    assert lim.check("a") is None and lim.check("a") is None
    assert "minute" in lim.check("a")
    c.t += 61
    assert lim.check("a") is None
    c.t += 61
    assert "today" in lim.check("a")          # 3 per day used
    assert lim.check("b") is None
    assert "daily limit" in lim.check("c")    # 4 for everyone used
    c.t += 86401
    assert lim.check("a") is None             # a new day


def test_client_ip_uses_the_proxy_header_only_when_trusted():
    h = {"x-forwarded-for": "203.0.113.7, 10.0.0.1"}
    assert client_ip(h, "10.0.0.1", trust_proxy=True) == "203.0.113.7"
    assert client_ip(h, "10.0.0.1", trust_proxy=False) == "10.0.0.1"
