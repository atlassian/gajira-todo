const _ = require('lodash')
const GitHub = require('./common/net/GitHub')
const Jira = require('./common/net/Jira')

module.exports = class {
  constructor({ githubEvent, argv, config, githubToken }) {
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

  async execute() {
    const { argv, githubEvent, config } = this
    const projectKey = argv.project
    const issuetypeName = argv.issuetype
    const label = argv.label
    let tasks = []

    if (githubEvent.pull_request.title.indexOf('automerge_release') !== -1) {
      console.log('Automerge is excluded from this action')

      return
    }

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
      let providedFields = [
        {
          key: 'project',
          value: {
            key: projectKey,
          },
        },
        {
          key: 'issuetype',
          value: {
            name: issuetypeName,
          },
        },
        {
          key: 'summary',
          value: `${platform} - Refactor in order to remove eslint disable: ${content}`,
        },
        {
          key: 'customfield_14697',
          value: {
            accountId: jiraIssue
              ? jiraIssue.fields.customfield_14697.accountId
              : '5faa5f3a8405b10077a8fd7e',
          }, // if there's no jira task then assign to Mikhail Nikolaevskiy in Growth team (change to somebody else onc he's gone)
        },
        {
          key: 'customfield_12601', //  team field
          value: { value: jiraIssue ? jiraIssue.fields.customfield_12601.value : 'Gusa Growth' },
        },
        {
          key: 'customfield_14613', //  manual QA required field
          value: { value: 'NO' },
        },
        {
          key: 'labels',
          value: label ? [label] : ['ESlint'],
        },
        {
          key: 'description',
          value: `Can be found in the following file: ${route.slice(5)}
        
        
        
        Action was triggered by this PR: ${githubEvent.pull_request.html_url}
        `,
        },
      ]

      if (projectKey === 'UVP') {
        providedFields = [
          ...providedFields,
          {
            key: 'customfield_14620', // UVP team field
            value: { value: 'UVP/UHC FE' },
          },
          {
            key: 'customfield_14621', // UVP team field
            value: { value: 'UVP' },
          },
        ]
      }

      if (argv.fields) {
        providedFields = [...providedFields, ...this.transformFields(argv.fields)]
      }

      const payload = providedFields.reduce(
          (acc, field) => {
            acc.fields[field.key] = field.value

            return acc
          },
          {
            fields: {},
          },
      )

      console.log('Constructed fields: ', payload)

      return (await this.Jira.createIssue(payload)).key
    })

    return { issues: await Promise.all(issues) }
  }

  transformFields(fields) {
    return Object.keys(fields).map((fieldKey) => ({
      key: fieldKey,
      value: fields[fieldKey],
    }))
  }

  async findEslintInPr(repo, prId) {
    const prDiff = await this.GitHub.getPRDiff(repo.full_name, prId)
    const rx = /^\+.*(?:\/\/|\/\*)\s+eslint-disable(.*)$/gm
    const routeRegex = /^\+\+\+.b\/.*$/gm

    const matches = prDiff.match(rx)

    if (!matches || !matches.length) return []

    return matches
        .map(_.trim)
        .filter(Boolean)
        .map((match) => {
          const end = prDiff.indexOf(match)

          const routeMatches = prDiff.slice(0, end).match(routeRegex)
          const lastRouteMatch = routeMatches[routeMatches.length - 1]

          return { content: match.slice(match.indexOf('eslint-disable')), route: lastRouteMatch }
        })
        .filter(
            (el) =>
                (el.route.includes('/src/') ||
                    el.route.includes('/modules/') ||
                    el.route.includes('/server/')) &&
                !el.route.includes('.test.') &&
                !el.route.includes('__specs__') &&
                !el.route.includes('__analytics__') &&
                !el.route.includes('__new_specs__'),
        )
  }
}
