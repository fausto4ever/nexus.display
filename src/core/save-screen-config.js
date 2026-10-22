import { canSelfConfigure, selfServicePatch } from './self-service-config.js';

// The Gateway response is authoritative. Never apply an optimistic edit to a screen
// that has been re-enrolled while the request was in flight.
export async function saveAuthorizedScreenConfig({client,screenId,config,changes,currentScreenId}) {
  if (!screenId || !canSelfConfigure(config)) throw new Error('DISPLAY_CONFIG_NOT_SELF_SERVICE');
  const patch = selfServicePatch(config,changes);
  const saved = await client.saveDisplayConfig(screenId,patch);
  if (currentScreenId() !== screenId) return {stale:true};
  const remote = saved.config || (await client.getDisplayConfig(screenId)).config;
  if (currentScreenId() !== screenId) return {stale:true};
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) throw new Error('INVALID_REMOTE_DISPLAY_CONFIG');
  return {stale:false,config:remote,revision:remote.configRevision??saved.configRevision??null};
}
