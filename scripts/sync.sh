#!/bin/sh
theme=$1
environment=$2

mkdir /paradigm
mount -t cifs //ds925p.nexdev.net/paradigm/deployments /paradigm -o username=gitlab.runner,password=5tgb^YHN7ujm,domain=LUMINET

existing_files=$(s3cmd -c /configs/$environment.s3cfg ls s3://scstream/$theme/ | awk '{print $4}' | sed "s|s3://scstream/$theme/||")

find /paradigm/$theme -type f | while read file; do
    filename=$(basename "$file")

    if echo "$existing_files" | grep -q "^$filename$"; then
        continue
    fi

    s3cmd -c /configs/$environment.s3cfg put "$file" "s3://scstream/$theme/$filename"
done

umount /paradigm