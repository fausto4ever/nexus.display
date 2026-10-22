// Gateway 0.26.0 only accepts these screen-editable fields in SELF_SERVICE mode.
// Display supports DELIVERIES only; do not expose unsupported legacy views.
const EDITABLE = new Set(['locationId','entityType','rows','showCounter','showDistance','showPriority']);
export function canSelfConfigure(config) {
  return config?.configurationMode === 'SELF_SERVICE' && config?.enabled !== false;
}
export function selfServicePatch(config, changes) {
  if (!canSelfConfigure(config)) throw new Error('DISPLAY_CONFIG_NOT_SELF_SERVICE');
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('INVALID_CONFIG_CHANGES');
  const patch = {};
  for (const [key,value] of Object.entries(changes)) {
    if (!EDITABLE.has(key)) throw new Error('DISPLAY_CONFIG_FIELD_NOT_EDITABLE');
    if (key === 'rows') {
      if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('DISPLAY_CONFIG_ROWS_INVALID');
    } else if (key.startsWith('show')) {
      if (typeof value !== 'boolean') throw new Error('DISPLAY_CONFIG_BOOLEAN_REQUIRED');
    } else if (value !== null && typeof value !== 'string') throw new Error('DISPLAY_CONFIG_STRING_REQUIRED');
    patch[key] = value;
  }
  return patch;
}
