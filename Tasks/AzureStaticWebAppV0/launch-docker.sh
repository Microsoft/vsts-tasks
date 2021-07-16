workspace="/working_dir"

params=()

envvars=$(( set -o posix ; set ) | grep -E -v '^(PATH|USER|LOGNAME|HOME|SHELL|VSCODE|SSH|BASH|NVM|HOSTNAME|GIT|NODE|PWD|TMPDIR)')

for ev in $envvars
do
    if [[ "$ev" == *"="* ]]; then
        params+=(-e $ev)
    fi
done

docker run \
    -e INPUT_AZURE_STATIC_WEB_APPS_API_TOKEN="$SWA_API_TOKEN" \
    -e GITHUB_WORKSPACE=$workspace \
    -e DEPLOYMENT_PROVIDER=DevOps \
    -e REPOSITORY_URL="$BUILD_REPOSITORY_URI" \
    -e IS_PULL_REQUEST=false \
    -e BASE_BRANCH="$BUILD_SOURCEBRANCHNAME" \
    "${params[@]}" \
    -v "$BUILD_SOURCESDIRECTORY:$workspace" \
    "$SWA_DEPLOYMENT_CLIENT" \
    ./bin/staticsites/StaticSitesClient upload