1. **Replace `alert()` in `ExportDataButton`**: Use inline visual feedback. Update the button to show an error message temporarily (e.g., text changes to "Premium Feature", color changes to error/warning) and then revert back.
2. **Replace `alert()` in `DeleteAccountButton`**: Use an inline error message near the buttons if deletion fails, rather than a blocking alert. We can add an `error` state.
3. **Replace `alert()` in `SubscriptionSection` (`handleSubscribe`)**: Show an inline success/info message instead of an alert, or change the button text temporarily to simulate the redirect info.
4. **Update `.Jules/palette.md`**: Add an entry about replacing `alert()` with inline feedback.
5. **Run tests & verify**: Ensure `pnpm lint` and `pnpm test` pass.
6. **Pre-commit steps**: Pre commit check.
