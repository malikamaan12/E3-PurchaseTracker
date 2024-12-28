export async function analyzeFormError(formData: any, error: any) {
  try {
    console.error("Form submission error:", {
      formData,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : error
    });

    // Standard form error analysis
    const issues = [];

    // Check for common form issues
    if (!formData) {
      issues.push("Form data is missing");
    }

    if (error instanceof Error) {
      // Check for validation errors
      if (error.message.includes("required")) {
        issues.push("Required fields are missing");
      }
      // Check for type mismatches
      if (error.message.includes("type")) {
        issues.push("Invalid data type in form fields");
      }
      // Check for format errors
      if (error.message.includes("format")) {
        issues.push("Data format is incorrect");
      }
    }

    // If no specific issues found, provide generic guidance
    if (issues.length === 0) {
      issues.push(
        "Please check all required fields are filled",
        "Ensure data formats are correct",
        "Verify field values meet validation rules"
      );
    }

    return issues.join("\n");
  } catch (analyzeError) {
    console.error("Error analysis failed:", analyzeError);
    return "Unable to analyze the error. Please check the form inputs and try again.";
  }
}