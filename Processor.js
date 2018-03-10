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
      this.video.addEventListener('play', this.process.bind(this))
      if (this.isPlaying) {
        console.log('Video is playing')
        this.process()
      }
    }

    process() {
      this.width = this.video.videoWidth
      this.height = this.video.videoHeight
      this.canvas.width = this.width
      this.canvas.height = this.height
      console.log('Processing video', this.width, this.height)
      this.timerCallback()
    }

    timerCallback() {
      if (this.video.paused || this.video.ended) {
        return
      }
      this.computeFrame()
      setTimeout(() => this.timerCallback(), 16) // roughly 60 frames per second
    }

    computeFrame() {
      this.context.drawImage(this.video, 0, 0, this.width, this.height)
      var frame = this.context.getImageData(0, 0, this.width, this.height)
      var l = frame.data.length / 4

      for (var i = 0; i < l; i++) {
        var grey =
          (frame.data[i * 4 + 0] +
            frame.data[i * 4 + 1] +
            frame.data[i * 4 + 2]) /
          3

        frame.data[i * 4 + 0] = grey
        frame.data[i * 4 + 1] = grey
        frame.data[i * 4 + 2] = grey
      }
      this.context.putImageData(frame, 0, 0)
    }
  }

  new Processor(video).doLoad()
}

module.exports = processor
