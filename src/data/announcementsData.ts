import { Announcement } from '../types';

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Welcome to CSE ST Fall 2026',
    date: 'Fall 2026 · Semester Start',
    category: 'General',
    description:
      'Welcome to the BRAC University CSE Student Tutor Program for Fall 2026. Student Tutors are here to support your learning journey in CSE110: Programming Language I (Java) throughout the semester.',
  },
  {
    id: 'ann-2',
    title: 'Official Discord Server',
    date: 'Fall 2026 · Community',
    category: 'Discord',
    description:
      'Join the official CSE Student Tutor Discord server for real-time online consultation, academic discussions, and announcements. Online consultation hours are 9:30 PM - 10:50 PM. You can also DM Imtiaz on Discord at bloodrayne_.',
    linkText: 'Join Discord Server',
    linkUrl: 'https://discord.gg/S6qrvUVrgF',
  },
  {
    id: 'ann-3',
    title: 'Consultation Room Information',
    date: 'Fall 2026 · Campus Locations',
    category: 'Location',
    description:
      'Offline consultations are held in Room 10G-33L (Building G, 10th Floor). The Thursday CSE110-07 Lab sessions are conducted in Room 09B-09L (Building B, 9th Floor).',
  },
  {
    id: 'ann-4',
    title: 'How to Get Academic Support',
    date: 'Fall 2026 · Student Guide',
    category: 'Guide',
    description:
      'To get the most out of your consultation, isolate the problem you are struggling with, bring your laptop or notes, and review the consultation schedule before visiting.',
  },
];

