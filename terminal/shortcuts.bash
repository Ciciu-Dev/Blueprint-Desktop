# BLUEPRINT Development Shortcuts

cproj() {
    cd "$HOME/Projects"
}

cblue() {
    cd "$HOME/MintBlue"
}

gs() {
    git status "$@"
}

gb() {
    git branch --show-current
}

mkcd() {
    if [ -z "$1" ]; then
        echo "Usage: mkcd folder"
        return 1
    fi
    mkdir -p -- "$1" && cd -- "$1"
}
