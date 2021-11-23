# eslint-disable-jira
Create a Jira issue for every eslint-disable comment in the Pull Request

## Usage

> ##### Note: this action requires [Jira Login Action](https://github.com/marketplace/actions/jira-login)

Create Jira issue from eslint-disable comments in pushed code.

Single-line comments in these formats:

```javascript
// eslint-disable-next-line no-undefined
```
```javascript
/* eslint-disable prefer-promise-reject-errors */
```

Example workflow which is triggered on pull request merge:
```yaml
on:
  pull_request:
    types: [closed]

jobs:
  build:
    if: github.event.pull_request.merged == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Login
        uses: atlassian/gajira-login@master
        env:
          JIRA_BASE_URL: ${{ secrets.URL }}
          JIRA_USER_EMAIL: ${{ secrets.EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.TOKEN }}

      - name: Find task key
        id: find_key
        uses: atlassian/gajira-find-issue-key@master
        with:
          string: ${{ github.event.pull_request.title }}
          from: ""

      - name: Create Jira Task
        uses: optimaxdev/eslint-disable-jira@master
        with:
          project: PROJECT_KEY
          issuetype: Improvement
          baseUrl: ${{ secrets.URL }}
          email: ${{ secrets.EMAIL }}
          token: ${{ secrets.TOKEN }}
          taskId: ${{ steps.find_key.outputs.issue }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

----
## Action Spec:

### Environment variables
- `GITHUB_TOKEN` - GitHub secret [token](https://developer.github.com/actions/creating-workflows/storing-secrets/#github-token-secret) is used to retrieve diffs 

### Inputs

- `project` - Key of the project
- `issuetype` - Type of the issue to be created. Example: 'Task'
- `baseUrl` - Base URL of you jira board
- `email` - Jira account email
- `token` - Jira account token
- `taskId` - ID of the task that this PR is linked to

### Outputs

- `issues`: Well-formed JSON array containing keys of all newly created issues


### Dev notes:

- Needs a task id to assign the created task to the appropriate person and team
- Handles multiple eslint-disables, whether they are in the same file or not. A separate task is created for each one of them.
- Created task has appropriate platform (D/M) in its summary, and the file route is listed in the description, as well as a link to the original PR