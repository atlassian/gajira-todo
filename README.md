# Jira TODO
Create issue for TODO comments

For examples on how to use this, check out the [gajira-demo](https://github.com/atlassian/gajira-demo) repository
> ##### Only supports Jira Cloud. Does not support Jira Server (hosted)

## Usage

> ##### Note: this action requires [Jira Login Action](https://github.com/marketplace/actions/jira-login)

Create Jira issue from TODO comments in pushed code.

Single-line comments in these formats:

```go
// TODO: refactor this callback mess
```
```ruby
# TODO: rewrite api client
```

Example workflow:
```yaml
- name: Create TODO
  uses: ./
  with:
    project: MC
    issuetype: Task
    description: Created automatically via GitHub Actions
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # https://help.github.com/en/articles/virtual-environments-for-github-actions#github_token-secret
```

----
## Action Spec:

### Environment variables
- `GITHUB_TOKEN` - GitHub secret [token](https://developer.github.com/actions/creating-workflows/storing-secrets/#github-token-secret) is used to retrieve diffs 

### Inputs

- `project` - Key of the project
- `issuetype` - Type of the issue to be created. Example: 'Task'
- `description` - Issue description

### Outputs

- `issues`: Well-formed JSON array containing keys of all newly created issues