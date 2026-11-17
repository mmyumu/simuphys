# CLAUDE.md

## Normandy

Normandy deploys and watches this project from `normandy.json`.

- The workflows listed under `tests` in `normandy.json` keep `workflow_dispatch`: Normandy reruns them every night on the default branch. A new test workflow goes into that list. Why: tests that run only when their files change let the default branch break unnoticed.
- Every image keeps a Docker `HEALTHCHECK` that asks the app itself. Why: Normandy and its releases tell an app that answers from a process that merely runs.
- A new file or folder belongs to a component of `normandy.json`. Why: Normandy flags the files no component claims.
