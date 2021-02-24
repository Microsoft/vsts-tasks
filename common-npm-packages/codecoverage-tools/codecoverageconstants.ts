
import * as path from "path";
import * as util from "./utilities";
import * as os from "os";


// Enable Jacoco Code Coverage for Gradle builds using this props
export function jacocoGradleMultiModuleEnable(excludeFilter: string, includeFilter: string, classFileDirectory: string, reportDir: string) {
    return `
allprojects {
    repositories {
        mavenCentral()
    }

    apply plugin: 'jacoco'
}

def jacocoExcludes = [${excludeFilter}]
def jacocoIncludes = [${includeFilter}]

subprojects {
    jacocoTestReport {
        doFirst {
            classDirectories.setFrom fileTree(dir: "${classFileDirectory}").exclude(jacocoExcludes).include(jacocoIncludes)
        }

        reports {
            html.enabled = true
            html.destination file("\${buildDir}/jacocoHtml")
            xml.enabled = true
            xml.destination file("\${buildDir}/summary.xml")
        }
    }
    test {
        jacoco {
            destinationFile = file("${reportDir}/jacoco.exec")
        }
    }
}

task jacocoRootReport(type: org.gradle.testing.jacoco.tasks.JacocoReport) {
    dependsOn = subprojects.test
    executionData.setFrom files(subprojects.jacocoTestReport.executionData)
    sourceDirectories.setFrom files(subprojects.sourceSets.main.allSource.srcDirs)
    def classDirectoriesString = files()

    doFirst {
        subprojects.each {
            if (new File("\${it.sourceSets.main.output.classesDirs}").exists()) {
                logger.info("Class directory exists in sub project: \${it.name}")
                logger.info("Adding class files \${it.sourceSets.main.output.classesDirs}")
                classDirectoriesString += fileTree(dir: "\${it.sourceSets.main.output.classesDirs}", includes: jacocoIncludes, excludes: jacocoExcludes)
            } else {
                logger.error("Class directory does not exist in sub project: \${it.name}")
            }
        }

        classDirectories.setFrom classDirectoriesString
    }

    reports {
        html.enabled = true
        xml.enabled = true
        xml.destination file("${reportDir}/summary.xml")
        html.destination file("${reportDir}/")
    }
}`;
}

export function jacocoGradleSingleModuleEnable(excludeFilter: string, includeFilter: string, classFileDirectory: string, reportDir: string) {
    return `
allprojects {
    repositories {
        mavenCentral()
    }

    apply plugin: 'jacoco'
}

def jacocoExcludes = [${excludeFilter}]
def jacocoIncludes = [${includeFilter}]

jacocoTestReport {
    doFirst {
        classDirectories.setFrom fileTree(dir: "${classFileDirectory}").exclude(jacocoExcludes).include(jacocoIncludes)
    }

    reports {
        html.enabled = true
        xml.enabled = true
        xml.destination file("${reportDir}/summary.xml")
        html.destination file("${reportDir}")
    }
}

test {
    finalizedBy jacocoTestReport
    jacoco {
        destinationFile = file("${reportDir}/jacoco.exec")
    }
}`;
}


// Enable Cobertura Code Coverage for Gradle builds using this props
export function coberturaGradleSingleModuleEnable(excludeFilter: string, includeFilter: string, classDir: string, sourceDir: string, reportDir: string) {
    if (!classDir) {
        classDir = "${project.sourceSets.main.output.classesDirs}";
    }
    if (!sourceDir) {
        sourceDir = "project.sourceSets.main.java.srcDirs";
    }

    return `
allprojects {
    repositories {
        mavenCentral()
    }
    apply plugin: 'net.saliman.cobertura'

    dependencies {
        testCompile 'org.slf4j:slf4j-api:1.7.12'
    }

    cobertura.coverageIncludes = [${includeFilter}]
    cobertura.coverageExcludes = [${excludeFilter}]
}

cobertura {
    coverageDirs = ["${classDir}"]
    coverageSourceDirs = ${sourceDir}
    coverageReportDir = new File('${reportDir}')
    coverageFormats = ['xml', 'html']
}`;
}
export function coberturaGradleMultiModuleEnable(excludeFilter: string, includeFilter: string, classDir: string, sourceDir: string, reportDir: string) {
    let data = `
allprojects {
    repositories {
        mavenCentral()
    }
    apply plugin: 'net.saliman.cobertura'

    dependencies {
        testCompile 'org.slf4j:slf4j-api:1.7.12'
    }

    cobertura.coverageIncludes = [${includeFilter}]
    cobertura.coverageExcludes = [${excludeFilter}]
}

test {
    dependsOn = subprojects.test
}

cobertura {
    coverageSourceDirs = []`;

    if (classDir) {
        data += `
        coverageDirs = ["${classDir}"]`;
    } else {
        data += `
    rootProject.subprojects.each {
        coverageDirs << file("\${it.sourceSets.main.output.classesDirs}")
    }`;
    }

    if (sourceDir) {
        data += `
    coverageDirs = ["${sourceDir}"]`;
    } else {
        data += `
    rootProject.subprojects.each {
        coverageSourceDirs += it.sourceSets.main.java.srcDirs
    }`;
    }
    data += `
    coverageFormats = [ 'xml', 'html' ]
    coverageMergeDatafiles = subprojects.collect { new File(it.projectDir, '/build/cobertura/cobertura.ser') }
    coverageReportDir = new File('${reportDir}')
}`;

    return data;
};

// Enable Jacoco Code Coverage for Maven builds using this props
export function jacocoMavenPluginEnable(includeFilter: string[], excludeFilter: string[], outputDirectory: string): any {
    let plugin = {
        "groupId": "org.jacoco",
        "artifactId": "jacoco-maven-plugin",
        "version": "0.8.4",
        "configuration": {
            "destFile": path.join(outputDirectory, "jacoco.exec"),
            "outputDirectory": outputDirectory,
            "dataFile": path.join(outputDirectory, "jacoco.exec"),
            "includes": [{
                "include": includeFilter,
            }],
            "excludes": [{
                "exclude": excludeFilter
            }]
        },
        "executions": {
            "execution": [
                {
                    "configuration":
                    {
                        "includes": [{
                            "include": "**/*",
                        }]
                    },
                    "id": "default-prepare-agent-vsts",
                    "goals": { "goal": "prepare-agent" }
                },
                {
                    "id": "default-report-vsts",
                    "goals": { "goal": "report" },
                    "phase": "test"
                }
            ]
        }
    };

    return plugin;
};
export function jacocoMavenMultiModuleReport(reportDir: string, srcData: string, classData: string, includeFilter: string, excludeFilter: string): string {
    let classNode = "";
    classData.split(",").forEach(c => {
        classNode += `<fileset dir="${c}"`;
        if (includeFilter) {
            classNode += ` includes="${includeFilter}"`;
        }
        if (excludeFilter) {
            classNode += ` excludes="${excludeFilter}"`;
        }
        classNode += ` />` + os.EOL;
    });
    let srcNode = "";
    if (util.isNullOrWhitespace(srcData)) {
        srcNode = `<fileset dir="." />`;
    } else {
        srcData.split(",").forEach(c => {
            srcNode += `<fileset dir="${c}" />` + os.EOL;
        });
    }

    let report = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>VstsReport</groupId>
  <artifactId>VstsReport</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <packaging>pom</packaging>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-antrun-plugin</artifactId>
        <version>1.8</version>
        <executions>
          <execution>
            <phase>post-integration-test</phase>
            <goals>
              <goal>run</goal>
            </goals>
            <configuration>
              <target>
                <echo message="Generating JaCoCo Reports" />
                <taskdef name="report" classname="org.jacoco.ant.ReportTask">
                  <classpath path="{basedir}/target/jacoco-jars/org.jacoco.ant.jar" />
                </taskdef>
                <report>
                  <executiondata>
                    <file file="${path.join(reportDir, "jacoco.exec")}" />
                  </executiondata>
                  <structure name="Jacoco report">
                    <classfiles>
                      ${classNode}
                    </classfiles>
                    <sourcefiles encoding="UTF-8">
                      ${srcNode}
                    </sourcefiles>
                  </structure>
                  <html destdir="${reportDir}" />
                  <xml destfile="${reportDir + path.sep}jacoco.xml" />
                  <csv destfile="${reportDir + path.sep}report.csv" />
                </report>
              </target>
            </configuration>
          </execution>
        </executions>
        <dependencies>
          <dependency>
            <groupId>org.jacoco</groupId>
            <artifactId>org.jacoco.ant</artifactId>
            <version>0.8.4</version>
          </dependency>
        </dependencies>
      </plugin>
    </plugins>
  </build>
</project>
    `;

    return report;
};

// Enable Cobertura Code Coverage for Maven builds using this props
export function coberturaMavenEnable(includeFilter: string, excludeFilter: string, aggregate: string): Q.Promise<any> {
    let includeTag = "";
    let excludeTag = "";
    if (!util.isNullOrWhitespace(excludeFilter)) {
        excludeFilter.split(",").forEach(ex => {
            excludeTag += `<exclude>${ex}</exclude>` + os.EOL;
        });
    }
    if (!util.isNullOrWhitespace(includeFilter)) {
        includeFilter.split(",").forEach(ex => {
            includeTag += `<include>${ex}</include>` + os.EOL;
        });
    }

    let ccProperty = `
    <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>cobertura-maven-plugin</artifactId>
        <version>2.7</version>
        <configuration>
          <formats>
            <format>xml</format>
            <format>html</format>
          </formats>
          <instrumentation>
            <includes>${includeTag}</includes>
            <excludes>${excludeTag}</excludes>
          </instrumentation>
          <aggregate>${aggregate}</aggregate>
        </configuration>
        <executions>
          <execution>
            <id>package-9af52907-6506-4b87-b16a-9883edee41bc</id>
            <goals>
              <goal>cobertura</goal>
            </goals>
            <phase>package</phase>
          </execution>
        </executions>
    </plugin>
  `;
    return util.convertXmlStringToJson(ccProperty);
};

export function coberturaMavenReport(): Q.Promise<any> {
    let ccProperty = `
      <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>cobertura-maven-plugin</artifactId>
        <version>2.7</version>
        <configuration>
          <formats>
            <format>xml</format>
            <format>html</format>
          </formats>
        </configuration>
      </plugin>
  `;
    return util.convertXmlStringToJson(ccProperty);
}

export function jacocoAntReport(reportDir: string, classData: string, sourceData: string): string {
    return `<?xml version="1.0"?>
<project name="JacocoReport">
    <target name="CodeCoverage_9064e1d0">
        <jacoco:report xmlns:jacoco="antlib:org.jacoco.ant">
            <executiondata>
                <file file="${path.join(reportDir, "jacoco.exec")}"/>
            </executiondata>
            <structure name="Jacoco report">
                <classfiles>${classData}</classfiles>
                <sourcefiles>${sourceData}</sourcefiles>
            </structure>
            <html destdir="${reportDir}" />
            <csv destfile="${reportDir + path.sep}summary.csv" />
            <xml destfile="${reportDir + path.sep}summary.xml" />
        </jacoco:report>
    </target>
</project>
    `;
}

export function jacocoAntCoverageEnable(reportDir: string): any {
    let file = path.join(reportDir,"jacoco.exec");
    return {
        $:
        {
            "destfile": file,
            "xmlns:jacoco": "antlib:org.jacoco.ant"
        }
    };
}

export function coberturaAntReport(srcDir: string, reportDir: string): string {
    return `<?xml version="1.0"?>
<project name="CoberturaReport">
  <property environment="env" />
  <path id="cobertura-classpath" description="classpath for instrumenting classes">
    <fileset dir="\${env.COBERTURA_HOME}">
      <include name="cobertura*.jar" />
      <include name="**/lib/**/*.jar" />
    </fileset>
  </path>
  <taskdef classpathref="cobertura-classpath" resource="tasks.properties" />
  <target name="CodeCoverage_9064e1d0">
    <cobertura-report format="html" destdir="${reportDir}" datafile="${reportDir + path.sep}cobertura.ser" srcdir="${srcDir}" />
    <cobertura-report format="xml" destdir="${reportDir}" datafile="${reportDir + path.sep}cobertura.ser" srcdir="${srcDir}" />
  </target>
</project>
    `;
}

export function coberturaAntCoverageEnable(): string {
    return `
<property environment="env" />
<path id="cobertura-classpath-vsts" description="classpath for instrumenting classes">
    <fileset dir="\${env.COBERTURA_HOME}">
        <include name="cobertura*.jar" />
        <include name="**/lib/**/*.jar" />
    </fileset>
</path>
<taskdef classpathref="cobertura-classpath-vsts" resource="tasks.properties" />
`;
}

export function coberturaAntInstrumentedClasses(baseDir: string, reportDir: string, classData: string): any {
  return `
<cobertura-instrument todir="${path.join(baseDir,"InstrumentedClasses")}" datafile="${path.join(reportDir,"cobertura.ser")}">
    ${classData}
</cobertura-instrument>
  `;
}

export function coberturaAntProperties(reportDir: string, baseDir: string): any {
    return `
        <sysproperty key="net.sourceforge.cobertura.datafile" file="${path.join(reportDir,"cobertura.ser")}" />
        <classpath location="${path.join(baseDir,"InstrumentedClasses")}" />
`;
}

export function coberturaAntClasspathRef(): string {
    return `
        <classpath refid="cobertura-classpath-vsts" />
`;
}

// Gradle Coberutra plugin
export const coberturaGradleBuildScript = `
buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath 'net.saliman:gradle-cobertura-plugin:2.2.7'
    }
}
`;
