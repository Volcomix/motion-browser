const puppeteer = require('puppeteer')

const executablePath = 'google-chrome-unstable'
const viewerUrl = 'http://localhost:3000'

class MotionBrowser {
  constructor() {
    this.main = this.main.bind(this)
    this.launch = this.launch.bind(this)
    this.loadViewer = this.loadViewer.bind(this)
    this.logUrls = this.logUrls.bind(this)
  }

  async main() {
    await this.launch()
    await this.loadViewer()
    const timeout = setInterval(this.logUrls, 1000)
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

  async logUrls() {
    const targets = await this.browser.targets()
    const result = await Promise.all(
      targets
        .filter(target => target.type() === 'page')
        .filter(target => !target.url().startsWith(viewerUrl))
        .filter(target => !target.url().startsWith('chrome://'))
        .map(async target => {
          const page = await target.page()
          const frames = page.frames()
          const videos = await Promise.all(
            frames.map(frame =>
              frame.$$eval('video', videos =>
                videos.map(video => video.src).filter(src => !!src),
              ),
            ),
          )
          return { url: target.url(), videos: [].concat(...videos) }
        }),
    )
    console.log(JSON.stringify(result))
  }
}

new MotionBrowser().main()
