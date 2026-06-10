# dotfiles task runner
# Install just: https://github.com/casey/just

# Trigger a stable release: opens the Release PR via release-please.
# Merging that PR creates the vX.Y.Z tag.
release-stable:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Triggering release workflow..."
    gh workflow run release.yml
    echo "Waiting for workflow to start..."
    sleep 5
    run_id=$(gh run list --workflow=release.yml --limit=1 --json databaseId --jq '.[0].databaseId')
    echo "Watching run $run_id..."
    gh run watch "$run_id" --exit-status
    echo ""
    echo "Release PR is open. Review and merge it to cut the release:"
    gh pr list --search "chore(main): release" --json url --jq '.[0].url' 2>/dev/null || true

# Tag and push a dev pre-release build
release-dev:
    #!/usr/bin/env bash
    set -euo pipefail
    version=$(jq -r '."."' .release-please-manifest.json)
    tag="v${version}-dev.$(date +%Y%m%d).$(git rev-parse --short HEAD)"
    echo "Tagging $tag"
    git tag "$tag"
    git push origin "$tag"

# Run all tests
test:
    ./tests/test.sh

# Quick lint only
lint:
    ./tests/test.sh quick

# Apply dotfiles to home directory
apply:
    chezmoi apply

# Preview what chezmoi would change
dry-run:
    chezmoi apply --dry-run

# Show chezmoi diff
diff:
    chezmoi diff

# Show chezmoi status
status:
    chezmoi status
