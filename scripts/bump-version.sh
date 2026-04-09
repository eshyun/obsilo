#!/bin/bash
# Obsidian Plugin Version Bumper & Release Script
# Usage:
#   ./scripts/bump-version.sh --local 2.3.4        # Update manifest and versions JSON only
#   ./scripts/bump-version.sh --release 2.3.4      # Full release (build + release with assets)
#   ./scripts/bump-version.sh --help

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

MANIFEST="$ROOT_DIR/manifest.json"
VERSIONS="$ROOT_DIR/versions.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_help() {
    echo "Usage:"
    echo "  ./scripts/bump-version.sh --local <version>     Update manifest and versions JSON"
    echo "  ./scripts/bump-version.sh --release <version>   Full release (build + assets + GitHub release)"
    echo ""
    echo "Options:"
    echo "  --local <version>    Update manifest.json and versions.json only"
    echo "  --release <version>  Full release: build, commit, tag, create GitHub release with assets"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/bump-version.sh --local 2.3.4"
    echo "  ./scripts/bump-version.sh --release 2.3.4"
}

bump_local() {
    local NEW_VERSION="$1"

    echo -e "${YELLOW}Bumping version to $NEW_VERSION...${NC}"

    # Update manifest.json
    if [ ! -f "$MANIFEST" ]; then
        echo -e "${RED}Error: manifest.json not found${NC}"
        exit 1
    fi

    # Use node to update JSON (requires node for cross-platform)
    node -e "
        const fs = require('fs');
        const manifest = JSON.parse(fs.readFileSync('$MANIFEST', 'utf8'));
        manifest.version = '$NEW_VERSION';
        fs.writeFileSync('$MANIFEST', JSON.stringify(manifest, null, 2) + '\\n');
        console.log('Updated manifest.json version to $NEW_VERSION');
    "

    # Update versions.json
    if [ ! -f "$VERSIONS" ]; then
        echo -e "${RED}Error: versions.json not found${NC}"
        exit 1
    fi

    node -e "
        const fs = require('fs');
        const versions = JSON.parse(fs.readFileSync('$VERSIONS', 'utf8'));
        versions['$NEW_VERSION'] = '1.4.0';
        fs.writeFileSync('$VERSIONS', JSON.stringify(versions, null, 2) + '\\n');
        console.log('Added $NEW_VERSION to versions.json');
    "

    echo -e "${GREEN}Version bump complete!${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  git add manifest.json versions.json"
    echo "  git commit -m \"chore: bump version to $NEW_VERSION\""
}

full_release() {
    local NEW_VERSION="$1"
    local TAG="v$NEW_VERSION"

    echo -e "${YELLOW}Starting full release for $NEW_VERSION...${NC}"

    # Check uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${RED}Error: You have uncommitted changes. Please commit or stash them first.${NC}"
        git status --short
        exit 1
    fi

    # 1. Bump version
    echo -e "${YELLOW}1/7 Updating version files...${NC}"
    bump_local "$NEW_VERSION"

    # 2. Build
    echo -e "${YELLOW}2/7 Building production bundle...${NC}"
    npm run build

    # 3. Commit
    echo -e "${YELLOW}3/7 Committing version changes...${NC}"
    git add manifest.json versions.json
    git commit -m "chore: bump version to $NEW_VERSION"

    # 4. Tag
    echo -e "${YELLOW}4/7 Creating git tag $TAG...${NC}"
    git tag -a "$TAG" -m "Release $NEW_VERSION"

    # 5. Push
    echo -e "${YELLOW}5/7 Pushing to origin...${NC}"
    git push origin main
    git push origin "$TAG"

    # 6. Create GitHub Release with assets
    echo -e "${YELLOW}6/7 Creating GitHub release with assets...${NC}"
    gh release create "$TAG" \
        --title "Release $NEW_VERSION" \
        --notes "Obsilo Agent $NEW_VERSION" \
        --generate-notes \
        main.js \
        manifest.json \
        styles.css

    # 7. Summary
    echo -e "${GREEN}Release $NEW_VERSION complete!${NC}"
    echo ""
    echo -e "${YELLOW}Summary:${NC}"
    echo "  - Version: $NEW_VERSION"
    echo "  - Tag: $TAG"
    echo "  - Release URL: https://github.com/eshyun/obsilo/releases/tag/$TAG"
    echo ""
    echo -e "${YELLOW}Check the release here:${NC}"
    echo "  https://github.com/eshyun/obsilo/releases/tag/$TAG"
}

# Main script
if [ "$1" == "--help" ] || [ -z "$1" ]; then
    print_help
    exit 0
fi

MODE="$1"
VERSION="$2"

if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Version is required${NC}"
    print_help
    exit 1
fi

# Validate version format (semver)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid version format. Use semver (e.g., 2.3.4)${NC}"
    exit 1
fi

case "$MODE" in
    --local)
        bump_local "$VERSION"
        ;;
    --release)
        full_release "$VERSION"
        ;;
    *)
        echo -e "${RED}Error: Unknown mode '$MODE'${NC}"
        print_help
        exit 1
        ;;
esac
