'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, FileText, Brain, BarChart3, Download, Zap, Shield, Clock, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-emerald-100 to-emerald-50 px-6 sm:px-8 lg:px-12 py-12 sm:py-16 lg:py-24">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="space-y-6 lg:space-y-8 px-2 sm:px-0">
            <div className="space-y-4 lg:space-y-6">
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-sm">
                AI-Powered Document Processing
              </Badge>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 leading-tight">
                Real Estate
                <br />
                <span className="text-emerald-600">Document Analysis</span>
                <br />
                Made Simple
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-gray-600 leading-relaxed max-w-2xl">
                Transform complex real estate documents into structured data with our AI-powered platform.
                Extract insights from rent rolls, offering memos, and financial statements in minutes.
              </p>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-gray-500">What you get:</div>
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-700">Instant document classification</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-700">Structured data extraction</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-700">Professional Excel reports</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center lg:justify-start">
              <Link href="/tool">
                <Button size="lg" className="px-6 sm:px-8 text-base sm:text-lg">
                  Try RExeli Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden">
              {/* Dashboard Header */}
              <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-emerald-800 font-medium">Processing Document...</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="p-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-emerald-100">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-sm text-gray-500">Total Properties</div>
                        <div className="text-2xl font-bold text-gray-900">1,247</div>
                        <div className="text-xs text-emerald-600">+12% from last month</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-emerald-100">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-sm text-gray-500">Documents</div>
                        <div className="text-2xl font-bold text-gray-900">856</div>
                        <div className="text-xs text-emerald-600">+8% processed</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-emerald-100">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-sm text-gray-500">Revenue</div>
                        <div className="text-2xl font-bold text-gray-900">$2.4M</div>
                        <div className="text-xs text-emerald-600">+15% growth</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Chart Area */}
                <Card className="border-emerald-100">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Document Processing</h3>
                        <Badge variant="secondary">Real-time</Badge>
                      </div>
                      <div className="h-32 bg-emerald-50 rounded-lg flex items-end justify-between p-4">
                        <div className="w-8 bg-emerald-200 rounded-t" style={{height: '60%'}}></div>
                        <div className="w-8 bg-emerald-300 rounded-t" style={{height: '80%'}}></div>
                        <div className="w-8 bg-emerald-400 rounded-t" style={{height: '40%'}}></div>
                        <div className="w-8 bg-emerald-500 rounded-t" style={{height: '90%'}}></div>
                        <div className="w-8 bg-emerald-600 rounded-t" style={{height: '70%'}}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Recent Documents</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 p-3 bg-emerald-50 rounded-lg">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Rent Roll - 123 Main St</div>
                        <div className="text-xs text-gray-500">Processed 2 minutes ago</div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800">Complete</Badge>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">Offering Memo - Downtown Plaza</div>
                        <div className="text-xs text-gray-500">Processing...</div>
                      </div>
                      <Badge variant="secondary">In Progress</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-12 sm:py-16 lg:py-24 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 lg:space-y-6 mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Powerful Features for Real Estate Professionals</h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need to transform complex real estate documents into actionable insights
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <Card className="border-emerald-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">AI Document Classification</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Automatically identify rent rolls, offering memos, lease agreements, and financial statements with 99% accuracy.
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Intelligent Data Extraction</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Extract tenant information, rental rates, financial metrics, and property details with precision.
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Download className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Professional Excel Export</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Generate formatted Excel reports with summaries, charts, and detailed analysis ready for stakeholders.
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Efficient Processing</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Process documents up to 25MB with our optimized AI pipeline and real-time progress tracking. Typical processing: 2-3 minutes.
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Secure & Compliant</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Enterprise-grade security with encrypted storage, secure file handling, and full compliance standards.
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100 hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Save Hours of Work</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Eliminate manual data entry and reduce document processing time from hours to minutes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-gradient-to-br from-gray-50 to-slate-50 py-12 sm:py-16 lg:py-24 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 lg:space-y-6 mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Trusted by Real Estate Professionals</h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
              See what our users are saying about RExeli
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Testimonial 1 */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] card-hover">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-1 text-yellow-500">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 italic">&quot;RExeli has transformed how we process rent rolls. What used to take hours now takes minutes!&quot;</p>
                <div className="flex items-center space-x-3 pt-4 border-t border-gray-100">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    S
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Sarah Johnson</p>
                    <p className="text-sm text-gray-500">Property Manager, NYC</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Testimonial 2 */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] card-hover">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-1 text-yellow-500">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 italic">&quot;The AI accuracy is incredible. It extracts data from complex documents that would take my team days to process manually.&quot;</p>
                <div className="flex items-center space-x-3 pt-4 border-t border-gray-100">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    M
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Michael Chen</p>
                    <p className="text-sm text-gray-500">Investment Analyst</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Testimonial 3 */}
            <Card className="border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] card-hover">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center space-x-1 text-yellow-500">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-700 italic">&quot;Easy to use, fast, and reliable. RExeli has become an essential tool for our brokerage firm.&quot;</p>
                <div className="flex items-center space-x-3 pt-4 border-t border-gray-100">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    E
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Emily Rodriguez</p>
                    <p className="text-sm text-gray-500">Commercial Broker</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-white py-12 sm:py-16 lg:py-24 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 lg:space-y-6 mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Simple, Transparent Pricing</h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
              Choose the plan that works best for you
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <Card className="border-2 border-gray-200 hover:border-emerald-400 hover:shadow-xl transition-all duration-300 hover:scale-[1.03]">
              <CardContent className="p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Starter</h3>
                  <p className="text-sm text-gray-500 mt-1">Perfect for individuals</p>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-gray-900">$XX<span className="text-lg text-gray-500">/mo</span></div>
                  <p className="text-sm text-gray-500">Pricing coming soon</p>
                </div>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>XX documents/month</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Basic document types</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Excel exports</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Email support</span>
                  </li>
                </ul>
                <Link href="/auth/signup">
                  <Button variant="outline" className="w-full">Get Started</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-emerald-500 hover:shadow-2xl transition-all duration-300 hover:scale-[1.05] relative ring-4 ring-emerald-200 ring-opacity-50">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </div>
              <CardContent className="p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Professional</h3>
                  <p className="text-sm text-gray-500 mt-1">For growing businesses</p>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-gray-900">$XX<span className="text-lg text-gray-500">/mo</span></div>
                  <p className="text-sm text-gray-500">Pricing coming soon</p>
                </div>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Unlimited documents</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>All document types</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Advanced Excel exports</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>API access</span>
                  </li>
                </ul>
                <Link href="/auth/signup">
                  <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                    Get Started
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border-2 border-gray-200 hover:border-emerald-400 hover:shadow-xl transition-all duration-300 hover:scale-[1.03]">
              <CardContent className="p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Enterprise</h3>
                  <p className="text-sm text-gray-500 mt-1">For large organizations</p>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-gray-900">Custom</div>
                  <p className="text-sm text-gray-500">Contact for pricing</p>
                </div>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Unlimited everything</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Custom integrations</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Dedicated support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>SLA guarantees</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>On-premise deployment</span>
                  </li>
                </ul>
                <a href="mailto:admin@rexeli.com">
                  <Button variant="outline" className="w-full">Contact Sales</Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-12 sm:py-16 lg:py-24 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto text-center">
          <div className="space-y-6 lg:space-y-8">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-foreground">
              Ready to Transform Your Document Processing?
            </h2>
            <p className="text-lg sm:text-xl text-primary-foreground/80 max-w-3xl mx-auto">
              Join real estate professionals who are already saving hours with RExeli&apos;s AI-powered document analysis.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <Link href="/tool">
                <Button
                  variant="inverted"
                  size="lg"
                  className="px-6 sm:px-8 w-full sm:w-auto"
                >
                  Start Processing Documents
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <a href="mailto:admin@rexeli.com">
                <Button
                  variant="contrast"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  Contact Sales
                </Button>
              </a>
            </div>
            <p className="text-sm text-primary-foreground/70 mt-4">
              Questions? Email us at{' '}
              <a href="mailto:admin@rexeli.com" className="text-primary-foreground underline hover:text-primary-foreground/90">
                admin@rexeli.com
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}