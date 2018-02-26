const puppeteer = require('puppeteer')

const executablePath = 'google-chrome-unstable'
const viewerUrl = 'http://localhost:3000'

class MotionBrowser {
  constructor() {
    this.main = this.main.bind(this)
    this.launch = this.launch.bind(this)
    this.loadViewer = this.loadViewer.bind(this)
    this.parseTargets = this.parseTargets.bind(this)
    this.parseTarget = this.parseTarget.bind(this)
    this.getVideos = this.getVideos.bind(this)
    this.updateVideos = this.updateVideos.bind(this)
  }

  async main() {
    await this.launch()
    await this.loadViewer()
    const timeout = setInterval(this.parseTargets, 1000)
    this.browser.on('disconnected', () => clearInterval(timeout))
  }

  async launch() {
    this.browser = await puppeteer.launch({
      executablePath,
      headless: false,
    })
  }

  async loadViewer() {
    const pages = await this.browser.pages()
    await pages[0].goto(viewerUrl)
  }

  async parseTargets() {
    const targets = await this.browser.targets()
    const videos = await Promise.all(
      targets
        .filter(target => target.type() === 'page')
        .filter(target => !target.url().startsWith(viewerUrl))
        .filter(target => !target.url().startsWith('chrome://'))
        .map(this.parseTarget),
    )
    await this.updateVideos(videos)
  }

  async parseTarget(target) {
    const page = await target.page()
    return {
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

  async updateVideos(videos) {
    const pages = await this.browser.pages()
    const viewerPage = pages[0]
    await viewerPage.evaluate(
      videos => window.renderMotionViewer(videos),
      videos,
    )
  }
}

new MotionBrowser().main()
