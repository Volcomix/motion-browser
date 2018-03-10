function processor(video) {
  const canvasId = 'motion-browser-processor'

  class Processor {
    constructor(video) {
      this.video = video
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
        this.canvas.style['z-index'] = 99999
        this.canvas.style.width = '400px'
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
      this.width = 64
      this.height = 48
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
      this.context.putImageData(frame, 0, 0)

      this.diffContext.globalCompositeOperation = 'source-over'
      this.diffContext.drawImage(this.video, 0, 0, this.width, this.height)
    }
  }

  new Processor(video).doLoad()
}

module.exports = processor
