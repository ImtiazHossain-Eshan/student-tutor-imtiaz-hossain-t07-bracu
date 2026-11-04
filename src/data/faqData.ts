import { FaqItem } from '../types';

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'Where can I meet my Student Tutor?',
    answer:
      'You can meet Imtiaz Hossain in person at Room 10G-33L during offline consultation hours, or in Room 09B-09L during the Thursday CSE110-07 lab sessions. For online consultations, join the official CSE ST Discord server.',
    category: 'Consultation',
  },
  {
    id: 'faq-2',
    question: 'How can I get online assistance?',
    answer:
      'Join the official CSE Student Tutor Discord server (discord.gg/S6qrvUVrgF). Navigate to the #cse110 course channel to post your questions during online consultation hours (8:00 PM – 11:00 PM). A Student Tutor may also invite you to a voice channel for live walkthroughs.',
    category: 'Discord',
  },
  {
    id: 'faq-3',
    question: 'What should I do before joining a consultation?',
    answer:
      'Attempt the exercise or task first, identify the specific concept or bug causing difficulty, and have your code and error tracebacks ready. Bringing targeted questions helps your tutor assist you much more efficiently.',
    category: 'Preparation',
  },
  {
    id: 'faq-4',
    question: 'Can I contact my ST through email?',
    answer:
      'Yes, you can email imtiaz.hossain@g.bracu.ac.bd for general inquiries or if you cannot attend scheduled sessions. For real-time code debugging, attending scheduled offline or Discord sessions is recommended.',
    category: 'Contact',
  },
  {
    id: 'faq-5',
    question: 'Where can I find the consultation schedule?',
    answer:
      'The full consultation timetable is displayed in the Consultation Schedule section of this website. Use the toggle button at the top of the schedule to switch between Regular Time and Ramadan Time.',
    category: 'Schedule',
  },
  {
    id: 'faq-6',
    question: 'How can I get help with assignments and quizzes?',
    answer:
      'Student Tutors explain the core concepts, syntax, and logic behind problems, helping you understand how to approach assignments and quizzes independently. In accordance with university academic integrity, tutors will not write code for you or solve graded questions directly.',
    category: 'Academic Support',
  },
];

