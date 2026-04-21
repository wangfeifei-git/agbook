export interface Novel {
  id: string;
  title: string;
  genre?: string | null;
  summary?: string | null;
  targetWordCount?: number | null;
  styleGuide?: string | null;
  forbiddenRules?: string | null;
  status?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type SettingType =
  | 'worldview'
  | 'character'
  | 'faction'
  | 'location'
  | 'item'
  | 'rule'
  | 'style'
  | 'other';

export interface SettingItem {
  id: string;
  novelId: string;
  type: SettingType;
  name: string;
  summary?: string | null;
  content?: string | null;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export type OutlineLevel = 'novel' | 'volume' | 'chapter' | 'scene';

export interface OutlineNode {
  id: string;
  novelId: string;
  parentId?: string | null;
  level: OutlineLevel;
  title: string;
  summary?: string | null;
  goal?: string | null;
  orderIndex: number;
  status?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChapterRuleSet {
  narrativePerspective?: string;
  toneStyle?: string;
  dialogueRatioPreference?: 'low' | 'medium' | 'high';
  descriptionRatioPreference?: 'low' | 'medium' | 'high';
  mustIncludePoints?: string[];
  mustAvoidPoints?: string[];
  continuityRequirements?: string;
  mustGenerateOutlineFirst?: boolean;
  mustGenerateByScenes?: boolean;
  minWordCount?: number;
  maxWordCount?: number;
  extraInstructions?: string;
}

export interface ChapterPlan {
  id: string;
  novelId: string;
  outlineNodeId?: string | null;
  chapterNumber: number;
  title?: string | null;
  summary?: string | null;
  goal?: string | null;
  targetWordCount?: number | null;
  minWordCount?: number | null;
  maxWordCount?: number | null;
  status: 'planned' | 'generating' | 'drafted' | 'reviewing' | 'finalized';
  ruleSet: ChapterRuleSet;
  createdAt: number;
  updatedAt: number;
}

export interface ChapterDraft {
  id: string;
  novelId: string;
  chapterPlanId: string;
  currentVersionId?: string | null;
  status: 'empty' | 'drafted' | 'reviewed' | 'revised' | 'finalized';
  lastGeneratedAt?: number | null;
  updatedAt: number;
}

export type DraftSourceType = 'generated' | 'review_revised' | 'manual_edit';

export interface DraftVersion {
  id: string;
  draftId: string;
  versionNumber: number;
  content: string;
  sourceType: DraftSourceType;
  generationContext?: string | null;
  createdAt: number;
}

export type ReviewSeverity = 'info' | 'minor' | 'major' | 'critical';

export interface ReviewIssue {
  type: string;
  severity: ReviewSeverity;
  message: string;
  suggestion?: string;
  ruleSource?: string;
  relatedExcerpt?: string;
}

export interface ReviewReport {
  id: string;
  novelId: string;
  chapterPlanId: string;
  draftVersionId: string;
  result: 'pass' | 'warn' | 'fail';
  score?: number;
  summary?: string;
  issues: ReviewIssue[];
  createdAt: number;
}

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string | null;
  model: string;
  headers?: Record<string, string>;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}
