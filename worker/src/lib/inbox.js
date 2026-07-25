export function isInboxIdentity(identity) {
  return identity?.userType === 'admin' || identity?.userType === 'engineer';
}

export function canStartDirectConversation(sender, recipient) {
  if (!isInboxIdentity(sender) || !isInboxIdentity(recipient)) return false;
  if (sender.userId === recipient.userId && sender.userType === recipient.userType) return false;
  if (sender.userType === 'admin' || recipient.userType === 'admin') return true;
  if (sender.engineerRole === 'regional_lead') {
    return recipient.engineerRole === 'engineer' && recipient.regionalLeadId === sender.userId;
  }
  if (recipient.engineerRole === 'regional_lead') {
    return sender.engineerRole === 'engineer' && sender.regionalLeadId === recipient.userId;
  }
  return false;
}

export function isConversationParticipant(participants, auth) {
  return participants.some((participant) => (
    participant.user_id === auth.userId
    && participant.user_type === auth.userType
    && !participant.left_at
  ));
}
