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

    console.log('Jira team: ', jiraIssue.fields.customfield_12601.value)
    console.log('Jira team string: ', jiraIssue.fields.customfield_12601.value)

    console.log(jiraIssue)

    // console.log('conditions: ', githubEvent.commits, githubEvent.commits.length > 0)
    console.log('gh event: ', githubEvent)

    // githubEvent.pull_request.diff_url
    //
    // const diff = await fetch('https://github.com/optimaxdev/GlassesUSA-Desktop/pull/5931.diff')
    // console.log('PR diff: ', diff)

    if (Number(githubEvent.pull_request.commits) > 0) {
      // tasks = _.flatten(await this.findTodoInCommits(githubEvent.repository, githubEvent.commits))
      tasks = _.flatten(await this.findTodoInCommits(githubEvent.repository, [{ id: githubEvent.pull_request.head.sha }], githubEvent.pull_request.number))
      console.log(tasks)
    }

    if (tasks.length === 0) {
      console.log('no TODO found :(')

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

    const issues = tasks.map(async ({ summary, commitUrl }) => {
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
        value: summary,
      },
      {
        key: 'assignee',
        value: { accountId: jiraIssue.fields.assignee.accountId },
      }, {
        key: 'customfield_12601', //  team
        value: { value: jiraIssue.fields.customfield_12601.value },
      }, {
        key: 'labels',
        value: ['ESlint'],
      },
      ]

      if (!argv.description) {
        argv.description = `Created with GitHub commit ${commitUrl}`
      }

      providedFields.push({
        key: 'description',
        value: argv.description,
      })

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

  async findTodoInCommits (repo, commits, prID) {
    return Promise.all(commits.map(async (c) => {
      const res = await this.GitHub.getCommitDiff(repo.full_name, c.id)
      const prDiff = await this.GitHub.getPRDiff(repo.full_name, prID)
      const rx = /^\+.*(?:\/\/|#)\s+TODO:(.*)$/gm
      const routeRegex = /^\+\+\+.b\//gm

      console.log(prDiff)

      console.log('diff: ', res)

      return getMatches(res, rx, 1)
        .map(_.trim)
        .filter(Boolean)
        .map(s => ({
          commitUrl: 'asd',
          summary: s,
        }))
    }))
  }
}

function getMatches (string, regex, index) {
  index || (index = 1)
  const matches = []
  let match

  while (match = regex.exec(string)) {
    matches.push(match[index])
  }

  return matches
}
