const _ = require('lodash')
const fetch = require('node-fetch')
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

    const jiraIssue = await this.Jira.getIssue(config.issue)

    const platform = githubEvent.pull_request.html_url.indexOf('Desktop') !== -1 ? 'D' : 'M'

    console.log(jiraIssue)

    console.log('gh event: ', githubEvent)

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
        value: { accountId: jiraIssue.fields.assignee.accountId },
      }, {
        key: 'customfield_12601', //  team field
        value: { value: jiraIssue.fields.customfield_12601.value },
      }, {
        key: 'labels',
        value: ['ESlint'],
      }, {
        key: 'description',
        value: `Can be found in the following file: ${route}`,
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

      console.log('fields: ', payload)

      // return (await this.Jira.createIssue(payload)).key
    })

    return { issues: await Promise.all(issues) }
  }

  transformFields (fields) {
    return Object.keys(fields).map(fieldKey => ({
      key: fieldKey,
      value: fields[fieldKey],
    }))
  }

  async findEslintInPr (repo, prId) {
    const prDiff = await this.GitHub.getPRDiff(repo.full_name, prId)
    const rx = /^\+.*(?:\/\/|\/\*)\s+eslint-disable(.*)$/gm
    const routeRegex = /^\+\+\+.b\/.*$/gm

    const matches = getMatches(prDiff, rx, 1)

    if (!matches.length) return

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

//   async findTodoInCommits (repo, prID) {
//     return Promise.all(commits.map(async (c) => {
//       // const res = await this.GitHub.getCommitDiff(repo.full_name, c.id)
//       const prDiff = await this.GitHub.getPRDiff(repo.full_name, prID)
//       const rx = /^\+.*(?:\/\/|#)\s+TODO:(.*)$/gm
//       const routeRegex = /^\+\+\+.b\/.*$/gm
//
//       const matches = getMatches(prDiff, rx, 1)
//
//       if (!matches.length) return
//
//       // matches.map((match) => {
//       //   const end = prDiff.indexOf(match)
//       //
//       //   const routeMatches = prDiff.slice(0, end).match(routeRegex)
//       //   const lastRouteMatch = routeMatches[routeMatches.length - 1]
//       //
//       //   return { content: match, route: lastRouteMatch.slice(5) }
//       //
//       //   // const lastRoute = prDiff.slice().lastIndexOf()
//       // })
//
//       // console.log('diff: ', res)
//
//       // console.log('formatted matches: ', matches.map((match) => {
//       //   const end = prDiff.indexOf(match)
//       //
//       //   const routeMatches = prDiff.slice(0, end).match(routeRegex)
//       //   const lastRouteMatch = routeMatches[routeMatches.length - 1]
//       //
//       //   return { content: match, route: lastRouteMatch }
//       //
//       //   // const lastRoute = prDiff.slice().lastIndexOf()
//       // }))
//
//       return matches
//         .map(_.trim)
//         .filter(Boolean)
//         .map((match) => {
//           const end = prDiff.indexOf(match)
//
//           const routeMatches = prDiff.slice(0, end).match(routeRegex)
//           const lastRouteMatch = routeMatches[routeMatches.length - 1]
//
//           return { content: match, route: lastRouteMatch.slice(5) }
//         })
//     }))
//   }
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
