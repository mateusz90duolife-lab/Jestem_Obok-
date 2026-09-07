/** Shared data model. Card content is a discriminated union; no `any`. */

export type LevelId = '01' | '02' | '03' | '04' | '05';
export type CardType = 'question' | 'situation' | 'bridge' | 'back';

export interface QuestionCard {
  readonly type: 'question';
  readonly id: string;          // Q01 .. Q60
  readonly number: number;      // 1 .. 60
  readonly level: LevelId;
  readonly text: string;
}

export interface SituationCard {
  readonly type: 'situation';
  readonly id: string;          // S01 .. S12
  readonly number: number;      // 1 .. 12
  readonly title: string;
  readonly instruction: readonly string[];
  readonly footer: string;
}

export interface BridgeCard {
  readonly type: 'bridge';
  readonly id: string;          // B01 .. B05
  readonly number: number;      // 1 .. 5
  readonly level: LevelId;
  readonly caption: string;
}

export interface BackCard {
  readonly type: 'back';
  readonly id: 'BACK';
}

export type Card = QuestionCard | SituationCard | BridgeCard | BackCard;
export type FrontCard = QuestionCard | SituationCard | BridgeCard;

/* ------------------------------- typography ------------------------------- */

export type FamilyRole = 'display' | 'ui';

export interface TextStyle {
  readonly family: FamilyRole;
  readonly weight: number;
  readonly sizePt: number;
  readonly trackingEm: number;
  readonly lineHeightPt: number;
  readonly italic?: boolean;
}

/** Result of laying a string (or paragraph) into a measured column. */
export interface TextLayoutResult {
  readonly lines: readonly string[];
  readonly lineCount: number;
  readonly maxLineWidth: number;
  readonly totalHeight: number;
  readonly availableWidth: number;
  readonly availableHeight: number;
  readonly overflowX: boolean;
  readonly overflowY: boolean;
  readonly overflow: boolean;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly scaleFactor: number;
  readonly remainingWidth: number;
  readonly remainingHeight: number;
}

/* --------------------------------- layout --------------------------------- */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A positioned run of text ready for SVG emission. All units mm. */
export interface TextNode {
  readonly kind: 'text';
  readonly role: string;
  readonly x: number;
  readonly baseline: number;
  readonly text: string;
  readonly style: TextStyle;
  readonly fill: string;
  /** Measured advance width including tracking. */
  readonly width: number;
  /** Ink box used for safe-area checks. */
  readonly box: Rect;
  /** Semantic exemption from safe-area checks (full-bleed backgrounds). */
  readonly decorative?: boolean;
}

export interface PathNode {
  readonly kind: 'path';
  readonly role: string;
  readonly d: string;
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly box: Rect;
  readonly decorative?: boolean;
}

export interface RectNode {
  readonly kind: 'rect';
  readonly role: string;
  readonly rect: Rect;
  readonly fill: string;
  readonly rx?: number;
  readonly box: Rect;
  readonly decorative?: boolean;
}

export type LayoutNode = TextNode | PathNode | RectNode;

export interface CardLayout {
  readonly cardId: string;
  readonly type: CardType;
  readonly level?: LevelId;
  readonly background: string;
  readonly nodes: readonly LayoutNode[];
  readonly textLayouts: readonly TextLayoutResult[];
  readonly warnings: readonly string[];
  readonly failures: readonly string[];
  /** Auto-fit bookkeeping, present for question cards. */
  readonly fit?: FitOutcome;
}

export interface FitOutcome {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly measureMm: number;
  readonly lineCount: number;
  readonly iterations: number;
  readonly strategy: string;
  readonly score: number;
  readonly resolved: boolean;
}

/* ----------------------------------- QA ----------------------------------- */

export type QaStatus = 'PASS' | 'WARNING' | 'FAIL';
export type Severity = 'INFO' | 'WARNING' | 'ERROR' | 'FAIL';

export interface CardDiagnostics {
  readonly cardId: string;
  readonly type: string;
  readonly level?: LevelId;
  readonly status: QaStatus;
  readonly textLayouts: readonly TextLayoutResult[];
  readonly safeAreaViolations: readonly string[];
  readonly overflow: boolean;
  readonly warnings: readonly string[];
  readonly failures: readonly string[];
  readonly fit?: FitOutcome;
  readonly density?: number;
}

export interface Issue {
  readonly severity: Severity;
  readonly stage: string;
  readonly cardId?: string;
  readonly message: string;
}
