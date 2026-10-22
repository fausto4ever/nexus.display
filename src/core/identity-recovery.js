// Re-enrollment is only called after a confirmed screen identity rejection.
// Keep the ordering explicit: stop old stream, clear secrets, enroll, refresh,
// then attach the new stream. A network error must not call this function.
export async function recoverScreenIdentity({resetStream,clearIdentity,client,markUnlinked,enroll,setIdentity,refresh,connectStream}) {
  resetStream();
  clearIdentity();
  client.setScreenToken('');
  markUnlinked();
  const next = await enroll();
  if (!next?.screenId || !next?.screenToken) throw new Error('SCREEN_ENROLLMENT_INCOMPLETE');
  client.setScreenToken(next.screenToken);
  setIdentity(next);
  await refresh();
  void connectStream();
  return next;
}
