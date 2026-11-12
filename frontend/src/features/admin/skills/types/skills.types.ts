export interface SkillItem {
  id: number;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkillPayload {
  name: string;
  category: string;
  description?: string;
}

export interface UpdateSkillPayload {
  name: string;
  category: string;
  description?: string;
}

