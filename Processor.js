function processor(video) {
  const canvasId = 'motion-browser-processor'

  class Processor {
    constructor(video) {
      this.video = video

      this.width = 64
      this.height = 48
      this.pixelThreshold = 32
    }

    get isPlaying() {
      return !!(
        this.video.currentTime > 0 &&
        !this.video.paused &&
        !this.video.ended &&
        this.video.readyState > 2
      )
    }

    doLoad() {
      console.log(this.video)
      this.canvas = document.querySelector(`canvas#${canvasId}`)
      if (!this.canvas) {
        this.canvas = document.createElement('canvas')
        this.canvas.id = canvasId
        this.canvas.style.position = 'fixed'
        this.canvas.style.bottom = '0'
        this.canvas.style.width = '400px'
        this.canvas.style['z-index'] = 99999
        this.canvas.style['pointer-events'] = 'none'
        document.body.appendChild(this.canvas)
        console.log('Processor canvas created')
      }
      console.log(this.canvas)
      this.context = this.canvas.getContext('2d')
      console.log(this.context)

      this.diffCanvas = document.createElement('canvas')
      this.diffContext = this.diffCanvas.getContext('2d')

      this.video.addEventListener('play', this.startTimer.bind(this))
      if (this.isPlaying) {
        console.log('Video is playing')
        this.startTimer()
      }
    }

    startTimer() {
      this.canvas.width = this.width
      this.canvas.height = this.height
      this.diffCanvas.width = this.width
      this.diffCanvas.height = this.height
      console.log('Processing video', this.width, this.height)
      this.timerCallback()
    }

    timerCallback() {
      if (this.video.paused || this.video.ended) {
        return
      }
      this.computeFrame()
      setTimeout(() => this.timerCallback(), 100)
    }

    computeFrame() {
      this.diffContext.globalCompositeOperation = 'difference'
      this.diffContext.drawImage(this.video, 0, 0, this.width, this.height)

      const frame = this.diffContext.getImageData(0, 0, this.width, this.height)
      const box = this.processDiff(frame)
      this.context.putImageData(frame, 0, 0)
      this.drawBox(box)

      this.diffContext.globalCompositeOperation = 'source-over'
      this.diffContext.drawImage(this.video, 0, 0, this.width, this.height)
    }

    processDiff(frame) {
      const rgba = frame.data
      let score = 0
      const box = this.initBox
      for (let i = 0; i < rgba.length; i += 4) {
        const diff = this.processPixelDiff(rgba, i)
        if (diff >= this.pixelThreshold) {
          score++
          this.updateBox(box, i / 4)
        }
      }
      return box.xMax > -1 ? box : undefined
    }

    processPixelDiff(rgba, i) {
      const diff = rgba[i] * 0.3 + rgba[i + 1] * 0.6 + rgba[i + 2] * 0.1
      rgba[i] = 0
      rgba[i + 1] = Math.min(255, diff * 255 / this.pixelThreshold)
      rgba[i + 2] = 0
      return diff
    }

    get initBox() {
      return {
        xMin: this.width + 1,
        xMax: -1,
        yMin: this.height + 1,
        yMax: -1,
      }
    }

    updateBox(box, pixelIndex) {
      const x = pixelIndex % this.width
      const y = Math.floor(pixelIndex / this.width)
      box.xMin = Math.min(box.xMin, x)
      box.xMax = Math.max(box.xMax, x)
      box.yMin = Math.min(box.yMin, y)
      box.yMax = Math.max(box.yMax, y)
    }

    drawBox(box) {
      if (!box) {
        return
      }
      this.context.strokeStyle = 'white'
      this.context.strokeRect(
        box.xMin + 0.5,
        box.yMin + 0.5,
        box.xMax - box.xMin,
        box.yMax - box.yMin,
      )
    }
  }

  new Processor(video).doLoad()
}

module.exports = processor
