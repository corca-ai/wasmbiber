import { createBiber } from '../../dist/src/index.js'
const status = document.querySelector('#status')
const run = document.querySelector('#run')
const cancel = document.querySelector('#cancel')
let controller
const manifest = await fetch('../../assets/manifest.json').then(r => r.json())
const request = await fetch('./request.json').then(r => r.json())
const client = createBiber({ assetBaseUrl: new URL('../../assets/', import.meta.url), manifest })
cancel.onclick = () => controller?.abort()
run.onclick = async () => {
  controller = new AbortController()
  run.disabled = true
  cancel.disabled = false
  status.textContent = 'Generating locally…'
  try {
    const result = await client.run(request, { signal: controller.signal })
    document.querySelector('#output').value = result.bbl
    const offline = await client.offlineStatus()
    status.textContent = `Generated in ${Math.round(result.metrics.totalMs)} ms. Runtime cached: ${offline.ready}. The host must also cache this page and SDK for offline reopening.`
  } catch (error) { status.textContent = `${error.code}: ${error.message}` }
  finally { run.disabled = false; cancel.disabled = true }
}
window.addEventListener('pagehide', () => { void client.dispose() })
