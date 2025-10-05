# PR Validation Pipeline Setup Guide

This guide walks you through setting up the PR validation pipeline in Azure DevOps.

## Prerequisites

✅ Azure DevOps organization and project  
✅ GitHub repository connected to Azure DevOps  
✅ Approval gates configured on Staging and Prod environments  
✅ This repository cloned with the `.ado/` directory

## Step 1: Create the PR Validation Pipeline

1. **Navigate to Pipelines:**
   - Go to your Azure DevOps project
   - Click **Pipelines** in the left navigation
   - Click **New pipeline** (or **Create pipeline** if first pipeline)

2. **Connect to Repository:**
   - Select **GitHub** (or your repository source)
   - Select the **PCPC** repository
   - Authorize Azure Pipelines if prompted

3. **Configure Pipeline:**
   - Choose **Existing Azure Pipelines YAML file**
   - Branch: `main` (or your default branch)
   - Path: `/.ado/azure-pipelines-pr.yml`
   - Click **Continue**

4. **Review and Save:**
   - Review the pipeline YAML
   - Click **Save** (do not run yet)
   - Optionally rename to "PCPC - PR Validation"

## Step 2: Verify Pipeline Configuration

1. **Check Triggers:**
   - Pipeline → Edit → Triggers
   - Verify "Pull request validation" is enabled
   - Should be triggered on PRs to `main` and `develop`

2. **Check Permissions:**
   - No service connections needed (validation only)
   - Build service should have repo read access

## Step 3: Test the Pipeline

### Option A: Test with a New PR (Recommended)

1. **Create Test Branch:**
   ```bash
   git checkout -b test/pr-pipeline
   ```

2. **Make a Small Change:**
   ```bash
   echo "# Testing PR Pipeline" >> .ado/TEST.md
   git add .ado/TEST.md
   git commit -m "test: verify PR validation pipeline"
   git push origin test/pr-pipeline
   ```

3. **Create Pull Request:**
   - Go to GitHub (or your repo host)
   - Create PR from `test/pr-pipeline` to `main`
   - Pipeline should start automatically

4. **Monitor Pipeline:**
   - Check Azure DevOps → Pipelines
   - Watch the PR validation pipeline run
   - Review results (should complete in 5-10 minutes)

### Option B: Manual Run (Not Recommended)

1. **Run Pipeline Manually:**
   - Pipelines → PCPC - PR Validation
   - Click **Run pipeline**
   - Select branch: `main`
   - Click **Run**

2. **Review Results:**
   - Pipeline will run but without PR context
   - Some validations may behave differently
   - Better to test with actual PR

## Step 4: Review Pipeline Results

### Expected Results

✅ **Frontend Validation** (~3 minutes)
- Linting: Completed
- Tests: 17/17 passed
- Build: Successful
- Security: Audited

✅ **Backend Validation** (~2 minutes)
- Linting: Completed
- TypeScript: Compiled
- Tests: 9/9 passed
- Build: Successful
- Security: Audited

✅ **Infrastructure Validation** (~2 minutes)
- Terraform Format: Checked
- Module Validation: Completed
- TFLint: Analyzed
- Security: Scanned

✅ **APIM Validation** (~1 minute)
- OpenAPI Spec: Validated
- Policy XML: Checked
- APIM Structure: Verified
- API Operations: Validated

✅ **Summary** (~1 second)
- All validations passed
- PR ready for review

### View Detailed Results

1. **Test Results:**
   - Pipeline run → Tests tab
   - View passed/failed tests
   - See test durations

2. **Code Coverage:**
   - Pipeline run → Code Coverage tab
   - View coverage percentages
   - Browse coverage reports

3. **Logs:**
   - Pipeline run → Click any job
   - Expand steps to view logs
   - Download logs for debugging

## Troubleshooting

### Pipeline Doesn't Trigger on PR

**Problem:** PR created but pipeline doesn't start

**Solutions:**
1. Check pipeline triggers are enabled
2. Verify GitHub app is installed and authorized
3. Ensure PR targets `main` or `develop` branch
4. Check branch policies allow pipeline runs

### Frontend Tests Fail

**Problem:** Frontend validation stage fails on tests

**Solutions:**
1. Run tests locally: `npm test`
2. Check Node.js version matches (22.x)
3. Verify dependencies are correct: `npm ci`
4. Review test output in pipeline logs

### Backend Tests Fail

**Problem:** Backend validation stage fails on tests

**Solutions:**
1. Run tests locally: `npm test`
2. Check TypeScript compiles: `npx tsc --noEmit`
3. Verify dependencies are correct: `npm ci`
4. Review test output in pipeline logs

### Terraform Validation Fails

**Problem:** Infrastructure validation stage fails

**Solutions:**
1. Check format locally: `terraform fmt -check -recursive`
2. Validate locally: `terraform validate`
3. Run TFLint: `tflint`
4. Review Terraform error messages

### APIM Validation Fails

**Problem:** APIM validation stage fails

**Solutions:**
1. Verify OpenAPI spec exists and is valid
2. Check XML syntax in policy files
3. Validate with Spectral locally
4. Review APIM structure

## Next Steps

After the PR validation pipeline is working:

1. ✅ **PR Validation Complete** - Provides fast feedback on PRs
2. ⏳ **Multi-Stage CD Pipeline** - Build and deploy to multiple environments
3. ⏳ **Environment Variables** - Create per-environment Terraform variables
4. ⏳ **APIOps Migration** - Modernize API Management deployment
5. ⏳ **Advanced Testing** - Add API tests, E2E tests, smoke tests

## Pipeline Maintenance

### Updating the Pipeline

1. Edit files in `.ado/` directory
2. Commit and push changes
3. Create PR to test changes
4. Pipeline will validate itself
5. Merge when approved

### Adding New Validation

1. Create new template in `.ado/templates/`
2. Add stage to `azure-pipelines-pr.yml`
3. Test with PR
4. Update documentation

### Monitoring Performance

- Track pipeline duration over time
- Identify slow stages
- Optimize as needed
- Target: 5-10 minute total runtime

## Support

For issues or questions:
- Check Azure DevOps pipeline logs
- Review this setup guide
- Consult `.ado/README.md` for usage details
- See troubleshooting section above

---

**Version:** 1.0.0  
**Last Updated:** October 5, 2025  
**Status:** ✅ Ready for Use
