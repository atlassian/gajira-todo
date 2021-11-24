const _ = require('lodash')
const Jira = require('./common/net/Jira')
const GitHub = require('./common/net/GitHub')

module.exports = class {
  constructor ({ githubEvent, argv, config, githubToken }) {
    this.Jira = new Jira({
      baseUrl: config.baseUrl,
      token: config.token,
      email: config.email,
    })

    this.GitHub = new GitHub({
      token: githubToken,
    })

    this.config = config
    this.argv = argv
    this.githubEvent = githubEvent
    this.githubToken = githubToken
  }

  async execute () {
    const { argv, githubEvent, config } = this
    const projectKey = argv.project
    const issuetypeName = argv.issuetype
    let tasks = []

    if (githubEvent.pull_request.title.indexOf('automerge_release') !== -1) return

    const jiraIssue = config.issue ? await this.Jira.getIssue(config.issue) : null

    const platform = githubEvent.pull_request.html_url.indexOf('Desktop') !== -1 ? 'D' : 'M'

    if (Number(githubEvent.pull_request.commits) > 0) {
      tasks = await this.findEslintInPr(githubEvent.repository, githubEvent.pull_request.number)
    }

    if (tasks.length === 0) {
      console.log('no eslint-disables found :)')

      return
    }

    // map custom fields
    const { projects } = await this.Jira.getCreateMeta({
      expand: 'projects.issuetypes.fields',
      projectKeys: projectKey,
      issuetypeNames: issuetypeName,
    })

    if (projects.length === 0) {
      console.error(`project '${projectKey}' not found`)

      return
    }

    const [project] = projects

    if (project.issuetypes.length === 0) {
      console.error(`issuetype '${issuetypeName}' not found`)

      return
    }

    const issues = tasks.map(async ({ content, route }) => {
      let providedFields = [{
        key: 'project',
        value: {
          key: projectKey,
        },
      }, {
        key: 'issuetype',
        value: {
          name: issuetypeName,
        },
      }, {
        key: 'summary',
        value: `${platform} - Refactor in order to remove eslint disable: ${content}`,
      },
      {
        key: 'assignee',
        value: { accountId: jiraIssue ? jiraIssue.fields.assignee.accountId : '5faa5f3a8405b10077a8fd7e' }, // if there's no jira task then assign to Mikhail Nikolaevskiy in Growth team (change to somebody else onc he's gone)
      }, {
        key: 'customfield_12601', //  team field
        value: { value: jiraIssue ? jiraIssue.fields.customfield_12601.value : 'Gusa Growth' },
      }, {
        key: 'labels',
        value: ['ESlint'],
      }, {
        key: 'description',
        value: `Can be found in the following file: ${route}
        
        
        
        Action was triggered by this PR: ${githubEvent.pull_request.html_url}
        `,
      },
      ]

      if (argv.fields) {
        providedFields = [...providedFields, ...this.transformFields(argv.fields)]
      }

      const payload = providedFields.reduce((acc, field) => {
        acc.fields[field.key] = field.value

        return acc
      }, {
        fields: {},
      })

      console.log('Constructed fields: ', payload)

      return (await this.Jira.createIssue(payload)).key
    })

    return { issues: await Promise.all(issues) }
  }

  transformFields (fields) {
    return Object.keys(fields).map((fieldKey) => ({
      key: fieldKey,
      value: fields[fieldKey],
    }))
  }

  async findEslintInPr (repo, prId) {
    const prDiff = await this.GitHub.getPRDiff(repo.full_name, prId)
    const rx = /^\+.*(?:\/\/|\/\*)\s+eslint-disable(.*)$/gm
    const routeRegex = /^\+\+\+.b\/.*$/gm

    const matches = getMatches(prDiff, rx, 1)

    if (!matches || !matches.length) return []

    return matches
      .map(_.trim)
      .filter(Boolean)
      .map((match) => {
        const end = prDiff.indexOf(match)

        const routeMatches = prDiff.slice(0, end).match(routeRegex)
        const lastRouteMatch = routeMatches[routeMatches.length - 1]

        return { content: match, route: lastRouteMatch.slice(5) }
      })
  }
}

function getMatches (string, regex, index) {
  index || (index = 1)
  const matches = []
  let match

  while (match = regex.exec(string)) {
    matches.push(match[index])
  }

  console.log('matches:', matches)

  return matches
}
