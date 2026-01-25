# DemoShip Generate Video Action

Automatically generate demo videos when pull requests are merged.

## Usage

Add this workflow to your repository:

```yaml
# .github/workflows/demo-video.yml
name: Generate Demo Video
on:
  pull_request:
    types: [closed]

jobs:
  demo:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write  # Required to post comments
    steps:
      - uses: demoship/generate-video@v1
        with:
          api-key: ${{ secrets.DEMOSHIP_API_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Setup

1. Go to your [DemoShip Dashboard Settings](https://demoship.dev/dashboard/settings)
2. Create a new API key
3. Add the API key as a repository secret named `DEMOSHIP_API_KEY`

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `api-key` | DemoShip API key | Yes | - |
| `post-comment` | Post video link as PR comment | No | `true` |
| `api-url` | DemoShip API URL (for self-hosted) | No | `https://demoship.dev` |
| `timeout` | Max wait time in seconds | No | `300` |

## Outputs

| Output | Description |
|--------|-------------|
| `video-id` | Unique ID of the generated video |
| `share-url` | Shareable URL for the video |
| `status` | Final status (complete, failed) |

## Example with Custom Options

```yaml
- uses: demoship/generate-video@v1
  with:
    api-key: ${{ secrets.DEMOSHIP_API_KEY }}
    post-comment: false  # Don't post comment
    timeout: 600  # Wait up to 10 minutes
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Using Outputs

```yaml
- uses: demoship/generate-video@v1
  id: demo
  with:
    api-key: ${{ secrets.DEMOSHIP_API_KEY }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Use video URL
  run: echo "Video URL: ${{ steps.demo.outputs.share-url }}"
```

## License

MIT
