const puppeteer = require('puppeteer')
const Processor = require('./Processor')

const executablePath = 'google-chrome-unstable'
const viewerUrl = 'http://localhost:3000'

class MotionBrowser {
  async run() {
    await this.launch()
    await this.loadViewer()
    const timeout = setInterval(() => this.parseTargets(), 1000)
    this.browser.on('disconnected', () => clearInterval(timeout))
    this.browser.on('targetdestroyed', () => this.checkPages())
  }

  async launch() {
    this.browser = await puppeteer.launch({
      executablePath,
      appMode: true,
      args: ['--no-default-browser-check'],
    })
  }

  async checkPages() {
    const pages = await this.browser.pages()
    if (pages.length === 0) {
      this.browser.close()
    }
  }

  async loadViewer() {
    const pages = await this.browser.pages()
    this.viewerPage = pages[0]
    await this.viewerPage.goto(viewerUrl)
    await this.viewerPage.exposeFunction('selectVideo', selection =>
      this.selectVideo(selection),
    )
  }

  async parseTargets() {
    const targets = await this.browser.targets()
    let videoPages = await Promise.all(
      targets
        .filter(target => target.type() === 'page')
        .filter(target => !target.url().startsWith(viewerUrl))
        .filter(target => !target.url().startsWith('chrome://'))
        .map(target => this.parseTarget(target)),
    )
    videoPages = videoPages
      .filter(({ videos }) => videos.length > 0)
      .reduce((videoPages, videoPage) => {
        videoPages[videoPage.id] = videoPage
        return videoPages
      }, {})
    await this.updateVideos(videoPages)
  }

  async parseTarget(target) {
    const page = await target.page()
    return {
      id: target._targetId,
      url: target.url(),
      title: await page.title(),
      videos: await this.getVideos(page),
    }
  }

  async getVideos(page) {
    const frames = page.frames()
    const videos = await Promise.all(
      frames.map(frame =>
        frame.$$eval('video[src], video source[src]', videos =>
          videos.map(video => video.getAttribute('src')),
        ),
      ),
    )
    return [].concat(...videos)
  }

  async updateVideos(videoPages) {
    await this.viewerPage.evaluate(
      videoPages => window.renderMotionViewer(videoPages),
      videoPages,
    )
  }

  async selectVideo(selection) {
    console.log(selection)
    const video = await this.findVideo(selection)
    await video.executionContext().evaluate(Processor, video)
  }

  async findVideo(selection) {
    const target = await this.findTarget(selection.page.id)
    const page = await target.page()
    for (let frame of page.frames()) {
      const video = await frame.$(
        [
          `video[src='${selection.video}']`,
          `video source[src='${selection.video}']`,
        ].join(', '),
      )
      if (video) {
        console.log('Video found')
        return video
      }
    }
  }

  async findTarget(id) {
    const targets = await this.browser.targets()
    const target = targets.find(target => target._targetId === id)
    console.log('url:', target.url())
    return target
  }
}

module.exports = MotionBrowser
