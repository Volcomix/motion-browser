const puppeteer = require('puppeteer')

const executablePath = 'google-chrome-unstable'
const viewerUrl = 'http://localhost:3000'

class MotionBrowser {
  async main() {
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
    const page = pages[0]
    await page.goto(viewerUrl)
    await page.exposeFunction('selectVideo', console.log)
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
        frame.$$eval('video', videos =>
          videos.map(video => video.src).filter(src => !!src),
        ),
      ),
    )
    return [].concat(...videos)
  }

  async updateVideos(videoPages) {
    const pages = await this.browser.pages()
    await pages[0].evaluate(
      videoPages => window.renderMotionViewer(videoPages),
      videoPages,
    )
  }
}

new MotionBrowser().main()
