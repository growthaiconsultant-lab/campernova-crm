/** Build-time, non-secret label shared by browser, Node and Edge SDKs. */
export function observabilityEnvironment(vercelEnvironment, nodeEnvironment) {
  if (['production', 'preview', 'development'].includes(vercelEnvironment)) {
    return vercelEnvironment
  }
  return nodeEnvironment || 'development'
}
