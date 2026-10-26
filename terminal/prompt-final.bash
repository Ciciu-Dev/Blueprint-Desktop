# BLUEPRINT Final Bash Prompt

if [[ $- == *i* ]]; then

    __blueprint_branch() {
        local branch

        branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null) ||
        branch=$(git rev-parse --short HEAD 2>/dev/null) ||
        return 0

        printf ' [git:%s]' "$branch"
    }

    # Blue name, current directory, one Git indicator
    PS1='\[\e[38;5;75m\]BLUE\[\e[0m\] \w$(__blueprint_branch)\n\[\e[38;5;75m\]❯\[\e[0m\] '
fi
