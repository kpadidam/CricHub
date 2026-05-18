export type Extra = 'wd' | 'nb' | 'b' | 'lb';

export type WicketType =
  | 'bowled'
  | 'caught'
  | 'caught-and-bowled'
  | 'lbw'
  | 'run-out'
  | 'stumped'
  | 'hit-wicket'
  | 'obstructing-field'
  | 'hit-ball-twice'
  | 'retired-hurt'
  | 'retired-out';

export type WicketValidation = {
  valid: boolean;
  reason?: string;
};

const NB_OR_FREE_HIT_WICKETS = new Set<WicketType>([
  'run-out',
  'obstructing-field',
  'hit-ball-twice',
]);

const WIDE_WICKETS = new Set<WicketType>([
  'run-out',
  'stumped',
  'obstructing-field',
  'hit-wicket',
]);

const BYE_OR_LEG_BYE_WICKETS = new Set<WicketType>([
  'run-out',
  'obstructing-field',
  'hit-ball-twice',
]);

function reject(wicketType: WicketType, context: string): WicketValidation {
  return {
    valid: false,
    reason: `${wicketType} is not a valid dismissal on ${context}`,
  };
}

export function validateWicketForDelivery(
  extra: Extra | undefined,
  wicketType: WicketType,
  freeHitActive: boolean
): WicketValidation {
  if (extra === 'nb' || freeHitActive) {
    return NB_OR_FREE_HIT_WICKETS.has(wicketType)
      ? { valid: true }
      : reject(wicketType, extra === 'nb' ? 'a no-ball' : 'a free hit');
  }

  if (extra === 'wd') {
    return WIDE_WICKETS.has(wicketType)
      ? { valid: true }
      : reject(wicketType, 'a wide');
  }

  if (extra === 'b' || extra === 'lb') {
    return BYE_OR_LEG_BYE_WICKETS.has(wicketType)
      ? { valid: true }
      : reject(wicketType, extra === 'b' ? 'byes' : 'leg-byes');
  }

  return { valid: true };
}

