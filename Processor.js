function processor(video) {
  const canvasId = 'motion-browser-processor'

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

  class Processor {
    constructor(video) {
      if (video.tagName === 'SOURCE') {
        this.video = video.closest('video')
      } else {
        this.video = video
      }

      this.width = 256
      this.height = 192
      this.blockSize = 16
      this.searchArea = 7
      this.period = 100

      this.blockSize2 = this.blockSize * this.blockSize
      this.halfBlockSize = this.blockSize / 2
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
      this.video.setAttribute('crossorigin', 'anonymous')
      console.log(this.video)
      this.canvas = document.querySelector(`canvas#${canvasId}`)
      if (!this.canvas) {
        this.createCanvas()
      }
      console.log(this.canvas)
      this.ctx = this.canvas.getContext('2d')
      console.log(this.ctx)

      this.refCanvas = document.createElement('canvas')
      this.refCtx = this.refCanvas.getContext('2d')

      this.video.addEventListener('play', this.startTimer.bind(this))
      if (this.isPlaying) {
        console.log('Video is playing')
        this.startTimer()
      }
    }

    createCanvas() {
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

    startTimer() {
      this.canvas.width = this.width
      this.canvas.height = this.height
      this.refCanvas.width = this.width
      this.refCanvas.height = this.height
      console.log('Processing video', this.width, this.height)
      this.timerCallback()
    }

    timerCallback() {
      if (this.video.paused || this.video.ended) {
        return
      }
      this.computeFrame()
      setTimeout(() => this.timerCallback(), this.period)
    }

    computeFrame() {
      this.ctx.drawImage(this.video, 0, 0, this.width, this.height)
      const curFrame = this.ctx.getImageData(0, 0, this.width, this.height)
      const refFrame = this.refCtx.getImageData(0, 0, this.width, this.height)
      const blocks = this.processMotion(curFrame, refFrame)
      this.drawBlocks(blocks)
      this.refCtx.putImageData(curFrame, 0, 0)
    }

    processMotion(curFrame, refFrame) {
      for (let i = 0; i < curFrame.data.length; i += 4) {
        this.greyScale(curFrame.data, i)
      }
      const blocks = []
      const xMax = this.width - this.blockSize
      const yMax = this.height - this.blockSize
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
                    const curIdx = 4 * (x + i + (y + j) * this.width)
                    const refIdx = 4 * (xl + i + (yl + j) * this.width)
                    cost += Math.abs(
                      curFrame.data[curIdx] - refFrame.data[refIdx],
                    )
                  }
                }
                cost /= this.blockSize2
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
      for (let { xBlock: x1, yBlock: y1, x: x2, y: y2 } of blocks) {
        this.ctx.strokeStyle = 'green'
        this.ctx.strokeRect(x1, y1, this.blockSize, this.blockSize)
        this.ctx.beginPath()
        this.ctx.strokeStyle = 'red'
        this.ctx.moveTo(x1 + this.halfBlockSize, y1 + this.halfBlockSize)
        this.ctx.lineTo(x2 + this.halfBlockSize, y2 + this.halfBlockSize)
        this.ctx.stroke()
      }
    }
  }

  new Processor(video).doLoad()
}

module.exports = processor
