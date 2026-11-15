import { onBeforeUnmount } from 'vue'

const trackedForms = new Map()

export function useUnsavedChanges(key, getState, getMessage) {
  let baseline = null
  let active = false

  const hasChanges = () => active && JSON.stringify(getState()) !== baseline
  trackedForms.set(key, { hasChanges, getMessage })

  function startTracking() {
    active = true
    baseline = JSON.stringify(getState())
  }

  function clearTracking() {
    active = false
    baseline = null
  }

  onBeforeUnmount(() => trackedForms.delete(key))
  return { startTracking, clearTracking }
}

export function getUnsavedChangesMessage() {
  for (const form of trackedForms.values()) {
    if (form.hasChanges()) return form.getMessage()
  }
  return ''
}

window.addEventListener('beforeunload', (event) => {
  if (!getUnsavedChangesMessage()) return
  event.preventDefault()
  event.returnValue = ''
})
