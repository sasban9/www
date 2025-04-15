const puppeteer = require('puppeteer');
const fs = require('fs').promises;

// Function to generate a random number between min and max (inclusive)
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to generate a random course ID (6-7 digits)
function generateRandomCourseId() {
  // Randomly decide between 6 or 7 digits
  const numDigits = Math.random() < 0.5 ? 6 : 7;
  
  if (numDigits === 6) {
    return getRandomNumber(100000, 999999);
  } else {
    return getRandomNumber(1000000, 9999999);
  }
}

// Sleep function to add delay between requests
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
async function main() {
  console.log("Starting Udemy API data collection with Puppeteer...");
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless mode
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // Create a new page and set viewport
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    // First, visit the Udemy homepage to get cookies and establish a session
    console.log("Visiting Udemy homepage to establish a session...");
    await page.goto('https://www.udemy.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Wait a bit for cookies to be set
    await sleep(3000);
    
    // Generate 10 random course IDs
    const courseIds = [];
    for (let i = 0; i < 10; i++) {
      courseIds.push(generateRandomCourseId());
    }
    
    // Some known valid course IDs to include for better chances of success
    const knownIds = [567828, 625204, 995016, 1565838, 2196488];
    courseIds.splice(0, 5, ...knownIds); // Replace first 5 random IDs with known IDs
    
    console.log("Using course IDs:", courseIds);
    
    const results = [];
    
    // Make 10 API requests with course IDs
    for (let i = 0; i < courseIds.length; i++) {
      const courseId = courseIds[i];
      console.log(`\n[${i+1}/10] Fetching data for course ID: ${courseId}`);
      
      const apiUrl = `https://www.udemy.com/api-2.0/course-landing-components/${courseId}/me/?couponCode=ST14MT150425G3&components=slider_menu,add_to_cart,buy_button,deal_badge,discount_expiration,price_text,incentives,purchase,redeem_coupon,money_back_guarantee,base_purchase_section,purchase_tabs_context,lifetime_access_context,available_coupons,gift_this_course`;
      
      try {
        // Navigate to the API URL
        const response = await page.goto(apiUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        const status = response.status();
        console.log(`Response status: ${status}`);
        
        if (status === 200) {
          // Get the page content as JSON
          const content = await page.content();
          
          // Extract the pre-formatted JSON from the page
          const jsonContent = await page.evaluate(() => {
            const preElement = document.querySelector('pre');
            return preElement ? preElement.textContent : null;
          });
          
          if (jsonContent) {
            try {
              const data = JSON.parse(jsonContent);
              const numStudents = data.num_students || null;
              const title = data.title || 'N/A';
              
              console.log(`Course: "${title}" | Students: ${numStudents}`);
              
              results.push({
                courseId,
                title,
                numStudents,
                success: true,
                status
              });
            } catch (error) {
              console.error(`Error parsing JSON for course ${courseId}:`, error.message);
              results.push({
                courseId,
                numStudents: null,
                success: false,
                status,
                error: 'JSON parse error'
              });
            }
          } else {
            console.log(`No valid JSON content found for course ${courseId}`);
            results.push({
              courseId,
              numStudents: null,
              success: false,
              status,
              error: 'No JSON content'
            });
          }
        } else {
          console.log(`Failed to fetch data for course ${courseId} (Status: ${status})`);
          results.push({
            courseId,
            numStudents: null,
            success: false,
            status,
            error: `HTTP ${status}`
          });
        }
      } catch (error) {
        console.error(`Error fetching course ${courseId}:`, error.message);
        results.push({
          courseId,
          numStudents: null,
          success: false,
          status: 'Error',
          error: error.message
        });
      }
      
      // Add a random delay between requests
      if (i < courseIds.length - 1) {
        const delay = getRandomNumber(2000, 5000);
        console.log(`Waiting ${delay}ms before next request...`);
        await sleep(delay);
      }
    }
    
    // Print results in a nicely formatted table
    console.log("\nResults:");
    console.log("=========================================");
    console.log("Course ID   | Students   | Status | Title");
    console.log("-----------------------------------------");
    
    results.forEach(result => {
      const courseId = String(result.courseId).padEnd(11);
      const students = result.numStudents ? String(result.numStudents).padEnd(11) : 'N/A'.padEnd(11);
      const status = String(result.status).padEnd(7);
      const title = result.title ? (result.title.length > 20 ? result.title.substring(0, 17) + '...' : result.title) : 'N/A';
      console.log(`${courseId}| ${students}| ${status}| ${title}`);
    });
    
    console.log("=========================================");
    
    // Count successful requests
    const successfulRequests = results.filter(result => result.success).length;
    console.log(`Successfully fetched data for ${successfulRequests} out of ${results.length} requests.`);
    
    // Save results to a file
    await fs.writeFile('udemy-course-data.json', JSON.stringify(results, null, 2));
    console.log("\nSaved results to udemy-course-data.json");
    
    // Print detailed information for successful requests
    console.log("\nDetailed Course Information (Successful Requests Only):");
    results.filter(result => result.success).forEach((result, index) => {
      console.log(`\n[${index + 1}] Course ID: ${result.courseId}`);
      console.log(`Title: ${result.title}`);
      console.log(`Number of Students: ${result.numStudents}`);
    });
    
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Run the script
main().catch(error => {
  console.error("An error occurred:", error);
});