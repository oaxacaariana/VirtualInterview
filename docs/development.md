# Development Notes

## Documentation Workflow

When adding or changing features, update docs in this order:

1. Update `README.md` if setup or product summary changed.
2. Update `docs/routes.md` if routes changed.
3. Update `docs/data-model.md` if a collection shape changed.
4. Update `docs/architecture.md` if folders or request flow changed.
5. Update `docs/environment.md` if a config variable changed.

## Good Places to Document in Code

Prefer documenting:

- non-obvious control flow
- unusual persistence behavior
- OpenAI prompt assumptions
- edge-case handling

Avoid documenting:

- obvious assignments
- comments that restate syntax
- temporary notes that become stale quickly

## Suggested Future Docs

Good next documentation additions:

- sequence diagrams for upload and interview flows
- screenshots of major views
- architecture decision records
- deployment rollback checklist
- testing strategy notes

## Suggested Future Cleanup

As the project evolves, consider documenting:

- storage strategy for uploaded files
- auth/session lifecycle
- OpenAI usage boundaries and prompts
- rate limit and cost considerations
