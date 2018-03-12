function processor(video) {
  const canvasId = 'motion-browser-processor'

  const around = [
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

      this.blockSize = 16
      this.width = 32 * this.blockSize
      this.height = 24 * this.blockSize
      this.searchArea = 7
      this.threshold = 14

      /** 0 to requestAnimationFrame */
      this.period = 0

      this.xMax = this.width - this.blockSize
      this.yMax = this.height - this.blockSize
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
      if (this.period) {
        setTimeout(() => this.timerCallback(), this.period)
      } else {
        requestAnimationFrame(() => this.timerCallback())
      }
    }

    computeFrame() {
      this.ctx.drawImage(this.video, 0, 0, this.width, this.height)
      const curFrame = this.ctx.getImageData(0, 0, this.width, this.height)
      const refFrame = this.refCtx.getImageData(0, 0, this.width, this.height)
      const blocks = this.searchMatchingBlocks(curFrame, refFrame)
      this.drawBlocks(blocks)
      this.refCtx.putImageData(curFrame, 0, 0)
    }

    searchMatchingBlocks(curFrame, refFrame) {
      for (let i = 0; i < curFrame.data.length; i += 4) {
        this.greyScale(curFrame.data, i)
      }
      const blocks = []
      for (let x = this.blockSize; x < this.xMax; x += this.blockSize) {
        for (let y = this.blockSize; y < this.yMax; y += this.blockSize) {
          const block = this.searchMatchingBlock(x, y, curFrame, refFrame)
          blocks.push(block)
        }
      }
      return blocks
    }

    greyScale(pxl, i) {
      const grey = pxl[i] * 0.2126 + pxl[i + 1] * 0.7152 + pxl[i + 2] * 0.0722
      pxl[i] = grey
      pxl[i + 1] = grey
      pxl[i + 2] = grey
    }

    searchMatchingBlock(xCur, yCur, curFrame, refFrame) {
      let xRef = xCur
      let yRef = yCur
      for (let stepSize = 4; stepSize >= 1; stepSize /= 2) {
        const l = this.searchLocation(stepSize, xRef, yRef, curFrame, refFrame)
        if (!l) {
          return { xCur, yCur, xRef, yRef, hasMoved: false }
        }
        xRef = l.x
        yRef = l.y
      }
      return { xCur, yCur, xRef, yRef, hasMoved: true }
    }

    searchLocation(stepSize, xCur, yCur, curFrame, refFrame) {
      const cost = this.getCost(curFrame, xCur, yCur, refFrame, xCur, yCur)
      if (stepSize === 4 && cost < this.threshold) {
        return
      }
      return around.reduce(
        (best, location) => {
          const xRef = xCur + stepSize * location.x
          const yRef = yCur + stepSize * location.y
          const cost = this.getCost(curFrame, xCur, yCur, refFrame, xRef, yRef)
          if (cost < best.cost) {
            best.cost = cost
            best.location = { x: xRef, y: yRef }
          }
          return best
        },
        { cost, location: { x: xCur, y: yCur } },
      ).location
    }

    getCost(curFrame, xCur, yCur, refFrame, xRef, yRef) {
      let cost = 0
      for (let x = 0; x < this.blockSize; x++) {
        for (let y = 0; y < this.blockSize; y++) {
          const curIdx = 4 * (xCur + x + (yCur + y) * this.width)
          const refIdx = 4 * (xRef + x + (yRef + y) * this.width)
          cost += Math.abs(curFrame.data[curIdx] - refFrame.data[refIdx])
        }
      }
      return cost / this.blockSize2
    }

    drawBlocks(blocks) {
      blocks.forEach(({ xCur, yCur, xRef, yRef, hasMoved }) => {
        if (hasMoved) {
          this.ctx.strokeStyle = '#0f0'
          this.ctx.strokeRect(xCur, yCur, this.blockSize, this.blockSize)
          this.ctx.beginPath()
          this.ctx.strokeStyle = '#f00'
          this.ctx.moveTo(xCur + this.halfBlockSize, yCur + this.halfBlockSize)
          this.ctx.lineTo(xRef + this.halfBlockSize, yRef + this.halfBlockSize)
          this.ctx.stroke()
        }
      })
    }
  }

  new Processor(video).doLoad()
}

module.exports = processor
