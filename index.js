const fs = require('fs')
const YAML = require('yaml')
const core = require('@actions/core')

const cliConfigPath = `${process.env.HOME}/.jira.d/config.yml`
const configPath = `${process.env.HOME}/jira/config.yml`
const Action = require('./action')
const githubToken = process.env.GITHUB_TOKEN

// eslint-disable-next-line import/no-dynamic-require
const githubEvent = require(process.env.GITHUB_EVENT_PATH)
const config = YAML.parse(fs.readFileSync(configPath, 'utf8'))

async function exec () {
  try {
    const result = await new Action({
      githubEvent,
      argv: parseArgs(),
      config,
      githubToken,
    }).execute()

    if (result) {
      console.log(`Created issues: ${result.issues}`)

      // Produce a well-formed JSON array of all newly created issue keys
      core.setOutput("issues", JSON.stringify(result.issues, null, 4))

      return
    }

    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

function parseArgs () {
  return {
    project: core.getInput('project'),
    issuetype: core.getInput('issuetype'),
    description: core.getInput('description')
  }
}

exec()
