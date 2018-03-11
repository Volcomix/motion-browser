function processor(video) {
  const canvasId = 'motion-browser-processor'

  class Processor {
    constructor(video) {
      this.video = video

      this.width = 256
      this.height = 192
      this.blockSize = 16
      this.searchArea = 7
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

      this.referenceCanvas = document.createElement('canvas')
      this.referenceContext = this.referenceCanvas.getContext('2d')

      this.video.addEventListener('play', this.startTimer.bind(this))
      if (this.isPlaying) {
        console.log('Video is playing')
        this.startTimer()
      }
    }

    startTimer() {
      this.canvas.width = this.width
      this.canvas.height = this.height
      this.referenceCanvas.width = this.width
      this.referenceCanvas.height = this.height
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
      this.context.drawImage(this.video, 0, 0, this.width, this.height)
      const currentFrame = this.context.getImageData(
        0,
        0,
        this.width,
        this.height,
      )
      const referenceFrame = this.referenceContext.getImageData(
        0,
        0,
        this.width,
        this.height,
      )
      const blocks = this.processMotion(currentFrame, referenceFrame)
      this.drawBlocks(blocks)
      this.referenceContext.putImageData(currentFrame, 0, 0)
    }

    processMotion(currentFrame, referenceFrame) {
      for (let i = 0; i < currentFrame.data.length; i += 4) {
        this.greyScale(currentFrame.data, i)
      }
      const blocks = []
      const around = [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 0 },
        { x: 1, y: -1 },
        { x: 0, y: -1 },
        { x: -1, y: -1 },
        { x: -1, y: 0 },
        { x: -1, y: 1 },
      ]
      const xMax = this.width - this.blockSize
      const yMax = this.height - this.blockSize
      const blockSize2 = this.blockSize * this.blockSize
      for (
        let xBlock = this.blockSize;
        xBlock < xMax;
        xBlock += this.blockSize
      ) {
        for (
          let yBlock = this.blockSize;
          yBlock < yMax;
          yBlock += this.blockSize
        ) {
          let location
          let stepSize = 4
          let x = xBlock
          let y = yBlock
          for (let stepSize = 4; stepSize >= 1; stepSize /= 2) {
            location = around.reduce(
              (best, location) => {
                const xl = x + stepSize * location.x
                const yl = y + stepSize * location.y
                let cost = 0
                for (let i = 0; i < this.blockSize; i++) {
                  for (let j = 0; j < this.blockSize; j++) {
                    const currentIndex = 4 * (x + i + (y + j) * this.width)
                    const referenceIndex = 4 * (xl + i + (yl + j) * this.width)
                    cost += Math.abs(
                      currentFrame.data[currentIndex] -
                        referenceFrame.data[referenceIndex],
                    )
                  }
                }
                cost /= blockSize2
                if (cost < best.cost) {
                  best.cost = cost
                  best.location = { x: xl, y: yl }
                }
                return best
              },
              { cost: Infinity, location: undefined },
            ).location
            x = location.x
            y = location.y
          }
          blocks.push({ xBlock, yBlock, x, y })
        }
      }
      return blocks
    }

    greyScale(rgba, i) {
      const grey =
        rgba[i] * 0.2126 + rgba[i + 1] * 0.7152 + rgba[i + 2] * 0.0722
      rgba[i] = grey
      rgba[i + 1] = grey
      rgba[i + 2] = grey
      return grey
    }

    drawBlocks(blocks) {
      for (let { xBlock, yBlock, x, y } of blocks) {
        this.context.strokeStyle = 'green'
        this.context.strokeRect(xBlock, yBlock, this.blockSize, this.blockSize)
        this.context.beginPath()
        this.context.strokeStyle = 'red'
        this.context.moveTo(
          xBlock + this.blockSize / 2,
          yBlock + this.blockSize / 2,
        )
        this.context.lineTo(x + this.blockSize / 2, y + this.blockSize / 2)
        this.context.stroke()
      }
    }
  }

  new Processor(video).doLoad()
}

module.exports = processor
