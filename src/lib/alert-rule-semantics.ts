export type AlertOperator = 'lt' | 'gt' | 'lte' | 'gte';

export function compareAlertValue(value: number, operator: string, threshold: number): boolean {
  switch (operator as AlertOperator) {
    case 'lt': return value < threshold;
    case 'gt': return value > threshold;
    case 'lte': return value <= threshold;
    case 'gte': return value >= threshold;
    default: return false;
  }
}

export function alertOperatorLabel(operator: string): string {
  switch (operator as AlertOperator) {
    case 'lt': return '低于';
    case 'gt': return '高于';
    case 'lte': return '低于或等于';
    case 'gte': return '高于或等于';
    default: return '达到';
  }
}
