export type SessionType = 'offline' | 'online' | 'lab' | 'class';

export interface ScheduleSlot {
  id: string;
  day: 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  time: string;
  activity: string;
  location: string;
  type: SessionType;
  notes?: string;
}

export type ScheduleMode = 'regular' | 'ramadan';

export interface Announcement {
  id: string;
  title: string;
  date: string;
  category: 'General' | 'Discord' | 'Location' | 'Guide';
  description: string;
  linkText?: string;
  linkUrl?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface TutorProfileInfo {
  name: string;
  role: string;
  course: string;
  initial: string;
  email: string;
  offlineRoom: string;
  labRoom: string;
  onlinePlatform: string;
  term: string;
  termPeriod: string;
  maxHours: string;
  discordInviteUrl: string;
  discordUsername: string;
  slackUrl: string;
  slackMemberId: string;
  slackDisplayName: string;
}

