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
      this.zeroMotionBias = 4
      this.neighborThreshold = 6
      this.showBlocks = true
      this.showSpeed = false
      this.showLabels = true

      /** 0 to requestAnimationFrame */
      this.period = 34

      this.xMax = this.width - this.blockSize
      this.yMax = this.height - this.blockSize
      this.blocksWidth = this.xMax / this.blockSize - 1
      this.blocksHeight = this.yMax / this.blockSize - 1
      this.blockSize2 = this.blockSize * this.blockSize
      this.halfBlockSize = this.blockSize / 2
      this.neighborThreshold2 = this.neighborThreshold * this.neighborThreshold
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
      const labelsCount = this.labelBlocks(blocks)
      this.drawBlocks(blocks)
      this.refCtx.putImageData(curFrame, 0, 0)
    }

    searchMatchingBlocks(curFrame, refFrame) {
      for (let i = 0; i < curFrame.data.length; i += 4) {
        this.greyScale(curFrame.data, i)
      }
      const blocks = []
      for (let y = this.blockSize; y < this.yMax; y += this.blockSize) {
        for (let x = this.blockSize; x < this.xMax; x += this.blockSize) {
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
      if (stepSize === 4 && cost < this.zeroMotionBias) {
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
      for (let y = 0; y < this.blockSize; y++) {
        for (let x = 0; x < this.blockSize; x++) {
          const curIdx = 4 * (xCur + x + (yCur + y) * this.width)
          const refIdx = 4 * (xRef + x + (yRef + y) * this.width)
          cost += Math.abs(curFrame.data[curIdx] - refFrame.data[refIdx])
        }
      }
      return cost / this.blockSize2
    }

    labelBlocks(blocks) {
      let label = 1
      const queue = []
      for (let y = 0; y < this.blocksHeight; y++) {
        for (let x = 0; x < this.blocksWidth; x++) {
          let block = blocks[x + y * this.blocksWidth]
          if (!block.hasMoved || block.label) {
            continue
          }
          block.label = label
          queue.push(block)
          while (queue.length) {
            block = queue.shift()
            this.markNeighbors(queue, blocks, block, label)
          }
          label++
        }
      }
    }

    markNeighbors(queue, blocks, block, label) {
      const x = block.xCur / this.blockSize - 1
      const y = block.yCur / this.blockSize - 1
      around.forEach(location => {
        const xNeighbor = x + location.x
        if (xNeighbor < 0 || xNeighbor >= this.blocksWidth) {
          return
        }
        const yNeighbor = y + location.y
        if (yNeighbor < 0 || yNeighbor >= this.blocksHeight) {
          return
        }
        const neighbor = blocks[xNeighbor + yNeighbor * this.blocksWidth]
        if (
          neighbor.hasMoved &&
          !neighbor.label &&
          this.norm2(block, neighbor) < this.neighborThreshold2
        ) {
          neighbor.label = label
          queue.push(neighbor)
        }
      })
    }

    norm2(block1, block2) {
      const x1 = block1.xCur - block1.xRef
      const y1 = block1.yCur - block1.yRef
      const x2 = block2.xCur - block2.xRef
      const y2 = block2.yCur - block2.yRef
      const x = x1 - x2
      const y = y1 - y2
      return x * x + y * y
    }

    drawBlocks(blocks) {
      blocks.forEach(block => {
        if (!block.hasMoved) {
          return
        }
        if (this.showBlocks) {
          this.drawBlock(block)
        }
        if (this.showSpeed) {
          this.drawSpeed(block)
        }
        if (this.showLabels) {
          this.drawLabel(block)
        }
      })
    }

    drawBlock({ xCur, yCur }) {
      this.ctx.strokeStyle = '#0f0'
      this.ctx.strokeRect(xCur, yCur, this.blockSize, this.blockSize)
    }

    drawSpeed({ xCur, yCur, xRef, yRef }) {
      this.ctx.beginPath()
      this.ctx.strokeStyle = '#f00'
      this.ctx.moveTo(xCur + this.halfBlockSize, yCur + this.halfBlockSize)
      this.ctx.lineTo(xRef + this.halfBlockSize, yRef + this.halfBlockSize)
      this.ctx.stroke()
    }

    drawLabel({ xCur, yCur, label }) {
      this.ctx.font = '8px arial'
      this.ctx.fillStyle = '#f00'
      this.ctx.fillText(label, xCur + 2, yCur + this.halfBlockSize + 4)
    }
  }

  new Processor(video).doLoad()
}

module.exports = processor
