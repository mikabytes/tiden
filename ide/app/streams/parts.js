import { all, publish, respondTo, stream, waitFor } from "tiden"
import { eventChannel } from "redux-saga"
import hmr from "tiden/lib/api/hmr.js"

import explore from "../../lib/explore.js"

export default stream(`parts`, function* parts() {
  let parts

  yield respondTo(`get`, `parts`, function* () {
    if (!parts) {
      parts = yield explore()
    }

    yield all(parts.map(addExamplesToPart))

    return parts
  })

  const channel = eventChannel((dispatch) => {
    let cleanup
    cleanup = hmr((path) => {
      const changedPart = parts.find((it) => Object.values(it).includes(path))

      if (changedPart) {
        dispatch(changedPart.id)
      }
    })

    return cleanup
  })

  while (true) {
    const partId = yield waitFor(channel)

    const newParts = yield explore()
    const newPart = newParts.find((it) => it.id === partId)

    if (newPart) {
      // ensure only changed part is replaced, keep all old objects, and return new array
      // this is to make sure that object equality is maintained for unchanged entries
      yield addExamplesToPart(newPart)
      const result = []
      let found = false

      for (let i = 0; i < parts.length; i++) {
        if (parts[i].id === newPart.id) {
          result[i] = newPart
          found = true
          break
        } else {
          result[i] = parts[i]
        }
      }

      if (!found) {
        parts.push(newPart)
      }
      parts = result
      yield publish(`parts`, parts)
    }
  }
})

function* addExamplesToPart(part) {
  const demo = yield import(part.demoPath)
  part.examples = demo.examples
}
