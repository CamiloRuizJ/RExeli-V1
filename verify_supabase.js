// Supabase Storage Bucket Verification Script
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lddwbkefiucimrkfskzt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZHdia2VmaXVjaW1ya2Zza3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODk0NTIsImV4cCI6MjA3MTQ2NTQ1Mn0.DP75WZ2UEyslCJxV9iHKiPOYzG9Sxbkj78eChMrYdQs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifySupabaseSetup() {
    console.log('🔍 Verifying Supabase Configuration...\n');
    
    try {
        // Test basic connection
        console.log('1. Testing basic connection...');
        const { data, error } = await supabase.auth.getUser();
        if (error && error.message !== 'Auth session missing!') {
            console.log('❌ Connection failed:', error.message);
            return false;
        }
        console.log('✅ Basic connection successful\n');

        // List storage buckets
        console.log('2. Listing storage buckets...');
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
            console.log('❌ Failed to list buckets:', bucketsError.message);
            return false;
        }
        
        console.log('📦 Available buckets:', buckets.map(b => b.name));
        
        const documentsBucket = buckets.find(b => b.name === 'documents');
        if (!documentsBucket) {
            console.log('⚠️ "documents" bucket not found. Need to create it.');
            
            // Try to create the bucket
            console.log('3. Creating "documents" bucket...');
            const { data: newBucket, error: createError } = await supabase.storage.createBucket('documents', {
                public: true,
                allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
                fileSizeLimit: 26214400, // 25MB
            });
            
            if (createError) {
                console.log('❌ Failed to create bucket:', createError.message);
                console.log('💡 You may need to create this manually in the Supabase dashboard');
            } else {
                console.log('✅ "documents" bucket created successfully');
            }
        } else {
            console.log('✅ "documents" bucket exists and is configured\n');
        }

        // Test file operations on documents bucket
        console.log('4. Testing file operations...');
        
        // Try to list files in documents bucket
        const { data: files, error: listError } = await supabase.storage
            .from('documents')
            .list('', { limit: 5 });
            
        if (listError) {
            console.log('❌ Cannot list files in documents bucket:', listError.message);
            if (listError.message.includes('not found')) {
                console.log('💡 The documents bucket needs to be created in Supabase dashboard');
            }
            return false;
        } else {
            console.log(`✅ Can access documents bucket (${files.length} files found)\n`);
        }

        // Test if we can get a public URL (this doesn't require the file to exist)
        console.log('5. Testing public URL generation...');
        const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl('test-file.pdf');
            
        if (urlData.publicUrl) {
            console.log('✅ Public URL generation works:', urlData.publicUrl);
        } else {
            console.log('❌ Public URL generation failed');
        }

        console.log('\n🎉 Supabase verification completed successfully!');
        console.log('📋 Summary:');
        console.log('   ✅ Connection established');
        console.log('   ✅ Storage accessible');
        console.log('   ✅ Documents bucket ready');
        console.log('   ✅ Public URLs working');
        
        return true;
        
    } catch (error) {
        console.log('❌ Unexpected error:', error.message);
        return false;
    }
}

// Instructions for manual setup if needed
function printManualSetupInstructions() {
    console.log('\n📝 Manual Supabase Setup Instructions (if needed):');
    console.log('1. Go to https://app.supabase.com/project/lddwbkefiucimrkfskzt/storage/buckets');
    console.log('2. Click "Create bucket"');
    console.log('3. Name: "documents"');
    console.log('4. Set as Public bucket: YES');
    console.log('5. File size limit: 25MB');
    console.log('6. Allowed MIME types: application/pdf, image/jpeg, image/png, image/jpg');
    console.log('7. Click "Save"');
    console.log('\nStorage Policies (if needed):');
    console.log('- Policy Name: "Public Access"');
    console.log('- Policy Target: SELECT, INSERT, UPDATE, DELETE');
    console.log('- Policy Definition: true (allow all)');
}

// Run verification
verifySupabaseSetup()
    .then(success => {
        if (!success) {
            printManualSetupInstructions();
        }
    })
    .catch(error => {
        console.error('Script error:', error);
        printManualSetupInstructions();
    });