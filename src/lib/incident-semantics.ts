const ACKNOWLEDGEMENT_INCIDENT_TYPES = new Set(['PRICE_CHANGED']);

export function requiresIncidentAcknowledgement(type: string) {
  return ACKNOWLEDGEMENT_INCIDENT_TYPES.has(type);
}

export function canAutoResolveIncident(type: string) {
  return !requiresIncidentAcknowledgement(type);
}

export function resolvedIncidentLabel(type: string) {
  return requiresIncidentAcknowledgement(type) ? '已确认' : '已恢复';
}

export function resolvedIncidentTimeLabel(type: string) {
  return requiresIncidentAcknowledgement(type) ? '确认于' : '恢复于';
}

export function resolveIncidentActionLabel(type: string) {
  return requiresIncidentAcknowledgement(type) ? '确认' : '标记已解决';
}
